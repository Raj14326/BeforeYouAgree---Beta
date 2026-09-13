"""Fine-tune LEGAL-BERT for native eight-label UNFAIR-ToS classification.

The model predicts eight independent potentially unfair Terms-of-Service
categories for each clause. This is a multi-label task: one clause may belong
to no category, one category, or several categories at the same time.

Training, threshold selection, and checkpoint selection use the training and
validation splits only. The test split is loaded for provenance and leakage
auditing, but it is never used to choose a threshold, epoch, or candidate.
"""

import argparse  # Parse command-line configuration for a reproducible run.
import hashlib  # Create SHA-256 provenance fingerprints for input split files.
import json  # Save machine-readable training history and model metadata.
import platform  # Record the Python runtime version in the model manifest.
import random  # Sample risk and safe rows for each training epoch.
import time  # Measure epoch and validation duration.
from datetime import datetime, timezone  # Create a UTC model identifier.
from pathlib import Path  # Handle checkpoint and dataset paths safely.

import torch  # Provide tensors, loss functions, optimisation, and model execution.
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    get_linear_schedule_with_warmup,
    set_seed,
)

from .model import encode, pooled_logits  # Share long-clause handling with inference.
from .multilabel_data import (
    ID2LABEL,
    LABEL2ID,
    LABEL_DEFINITIONS,
    audit_multilabel_splits,
    choose_independent_thresholds,
    read_multilabel_rows,
)


def predict_scores(model, tokenizer, rows, args):
    """Return one sigmoid score vector per input row without updating weights.

    A clause can produce more than one token window when it is longer than
    ``args.max_length``. ``encode`` creates the overlapping windows and
    ``pooled_logits`` returns one eight-label logit vector per original clause
    by taking the maximum logit for each label across that clause's windows.

    Args:
        model: A Hugging Face sequence-classification model with eight logits.
        tokenizer: The tokenizer paired with the selected LEGAL-BERT checkpoint.
        rows: Validation rows containing a ``text`` field.
        args: Parsed command-line configuration.

    Returns:
        A list with one list of eight independent sigmoid scores per row.
    """
    scores = []

    # Evaluation mode disables dropout. inference_mode also avoids gradient and
    # autograd bookkeeping, making validation faster and more memory-efficient.
    model.eval()
    with torch.inference_mode():
        for start in range(0, len(rows), args.batch_size):
            batch = rows[start:start + args.batch_size]

            # Tokenisation may expand one clause into multiple overlapping
            # windows. The mapping identifies which original clause owns each
            # window so predictions can be pooled back to clause level.
            encoded, mapping = encode(
                tokenizer,
                [row["text"] for row in batch],
                args.max_length,
                args.stride,
                128,
            )
            logits = pooled_logits(model, encoded, mapping, len(batch), args.device)

            # BCEWithLogitsLoss trains independent label logits. Sigmoid turns
            # each logit into an independent 0--1 model score for thresholding.
            scores.extend(torch.sigmoid(logits).cpu().tolist())
    return scores


def main():
    """Parse configuration, train the model, validate each epoch, and save best.

    The best checkpoint is selected strictly from validation metrics. The saved
    directory contains the Hugging Face model files, tokenizer files, a full
    training history, and ``risk_config.json`` for reproducible serving.
    """
    parser = argparse.ArgumentParser(description=__doc__)  # Create the CLI parser.

    # All three splits are mandatory because split integrity is audited before
    # training. The test split is not used in the optimization loop.
    for name in ("train", "validation", "test"):
        parser.add_argument(f"--{name}", required=True)  # Require each audited split path.

    # ``base-model`` may be a Hugging Face model ID or a local checkpoint path.
    # ``base-model-source`` retains the public model identity in saved metadata
    # even when the actual weights are loaded from a local path.
    parser.add_argument("--base-model", default="nlpaueb/legal-bert-base-uncased")  # Model ID or local path.
    parser.add_argument("--base-model-source", default="nlpaueb/legal-bert-base-uncased")  # Provenance name.
    parser.add_argument("--revision", default="15b570cbf88259610b082a167dacc190124f60f6")  # Pinned model revision.
    parser.add_argument("--output", default="ml/models/bert-multilabel-base-v1")  # New checkpoint directory.

    # Training and token-window settings.
    parser.add_argument("--epochs", type=int, default=3)  # Maximum complete passes over sampled rows.
    parser.add_argument("--batch-size", type=int, default=16)  # Original clauses per optimiser update.
    parser.add_argument("--max-length", type=int, default=128)  # Maximum tokenizer window size.
    parser.add_argument("--stride", type=int, default=32)  # Token overlap between adjacent windows.

    # The pretrained encoder and newly initialized classifier head use separate
    # learning rates. The classifier head can usually learn faster safely.
    parser.add_argument("--learning-rate", type=float, default=2e-5)  # Pretrained encoder learning rate.
    parser.add_argument("--head-learning-rate", type=float, default=1e-4)  # New classifier-head learning rate.

    # Risk rows are oversampled to a chosen binary-risk prevalence. Positive
    # label weights then compensate for remaining multi-label imbalance.
    parser.add_argument("--max-pos-weight", type=float, default=20.0)  # Cap for rare-label loss weights.
    parser.add_argument("--risk-sampling-ratio", type=float, default=0.5)  # Risk-row share in each epoch.
    parser.add_argument(
        "--threshold-beta",
        type=float,
        default=1.0,
        help="F-beta objective used for per-label validation threshold selection",
    )
    parser.add_argument(
        "--selection-metric",
        choices=("macro_fbeta", "macro_f1"),
        default="macro_fbeta",
        help="Validation metric for checkpoint selection; never uses test results",
    )
    parser.add_argument("--warmup-ratio", type=float, default=0.1)  # Fraction of schedule used for warm-up.
    parser.add_argument("--min-recall", type=float, default=0.70)  # Per-label threshold recall floor.
    parser.add_argument("--review-margin", type=float, default=0.08)  # Near-threshold review band.
    parser.add_argument("--seed", type=int, default=5120)  # Random seed for reproducibility.
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")  # Compute device.
    parser.add_argument("--threads", type=int, default=8)  # CPU threads for tokenisation and tensor work.
    args = parser.parse_args()  # Convert the supplied command-line values into one namespace.

    # This label is metadata only. The actual architecture comes from the
    # checkpoint loaded below, while the source name documents model provenance.
    architecture = (
        "LEGAL-BERT-Small"
        if "legal-bert-small" in args.base_model_source
        else "LEGAL-BERT-Base"
    )
    model_family = "SMALL" if architecture == "LEGAL-BERT-Small" else "BASE"

    # Reject invalid settings before writing any output files or loading a model.
    if args.epochs < 1 or args.batch_size < 1 or args.threads < 1:
        parser.error("epochs, batch-size and threads must be positive")
    if (
        not 0 < args.risk_sampling_ratio < 1
        or args.max_pos_weight < 1
        or args.threshold_beta <= 0
    ):
        parser.error("sampling ratio must be in (0,1), weight cap >=1 and beta >0")

    # Read the original eight-label annotations for every split and verify that
    # duplicate text or group leakage does not cross train/validation/test.
    splits = {
        name: read_multilabel_rows(getattr(args, name))
        for name in ("train", "validation", "test")
    }
    audit = audit_multilabel_splits(splits)

    # Refusing a non-empty target prevents a new run from silently overwriting
    # the weights and metadata of an earlier experiment.
    output = Path(args.output)
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output is not empty; choose a new directory")
    output.mkdir(parents=True, exist_ok=True)

    # Seed Python, PyTorch, and Transformers helpers for more reproducible row
    # sampling and model initialization. Some GPU operations may remain
    # nondeterministic depending on the hardware and PyTorch configuration.
    set_seed(args.seed)  # Seed supported random generators before model construction.
    torch.set_num_threads(args.threads)  # Respect the requested CPU parallelism limit.

    # A local path enables offline/reproducible loading; a model ID permits the
    # Transformers library to fetch the pinned revision when needed.
    local_checkpoint = Path(args.base_model).exists()  # Detect whether network access is unnecessary.
    tokenizer = AutoTokenizer.from_pretrained(
        args.base_model,
        revision=args.revision,
        local_files_only=local_checkpoint,
    )
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model,
        revision=args.revision,
        local_files_only=local_checkpoint,
        num_labels=8,
        label2id=LABEL2ID,
        id2label=ID2LABEL,
        problem_type="multi_label_classification",
        # The pretrained checkpoint does not contain the task-specific eight
        # label head, so incompatible head weights are intentionally replaced.
        ignore_mismatched_sizes=True,
    )

    # Keep the configured window size within the model's positional-embedding
    # capacity. The lower bound leaves room for special tokenizer tokens.
    if not 8 <= args.max_length <= model.config.max_position_embeddings:
        parser.error("max-length exceeds model capacity")
    model.to(args.device)  # Move all model parameters to CPU, CUDA, or MPS.

    train = splits["train"]  # Keep a short reference to the audited training split.
    risky_rows = [row for row in train if any(row["targets"])]  # Rows with at least one positive label.
    safe_rows = [row for row in train if not any(row["targets"])]  # Rows with no positive labels.

    # Each epoch contains the same number of rows as the original training
    # split. Risk rows may be sampled with replacement; safe rows are sampled
    # without replacement when enough are available. Validation prevalence is
    # never modified.
    risk_count = round(len(train) * args.risk_sampling_ratio)
    if not risky_rows or not safe_rows or not 0 < risk_count < len(train):
        parser.error("training requires both classes and nonempty sampled groups")

    # Estimate each label's positive rate under the *sampled* epoch prevalence,
    # then use inverse prevalence as BCE positive weights. Clipping prevents a
    # very rare label from dominating the total loss and destabilizing training.
    sampled_positive_rate = torch.tensor(
        [
            (risk_count / len(train))
            * sum(row["targets"][label_index] for row in risky_rows)
            / len(risky_rows)
            for label_index in range(8)
        ],
        device=args.device,
    )
    pos_weight = torch.clamp(
        (1 - sampled_positive_rate) / sampled_positive_rate,
        max=args.max_pos_weight,
    )

    # Use discriminative learning rates: a conservative rate for the pretrained
    # encoder and a higher rate for the randomly initialized classification head.
    classifier_ids = {id(parameter) for parameter in model.classifier.parameters()}
    optimizer = torch.optim.AdamW(
        [
            {
                "params": [
                    parameter
                    for parameter in model.parameters()
                    if id(parameter) not in classifier_ids
                ],
                "lr": args.learning_rate,
            },
            {"params": list(model.classifier.parameters()), "lr": args.head_learning_rate},
        ],
        weight_decay=0.01,
    )
    criterion = torch.nn.BCEWithLogitsLoss(pos_weight=pos_weight)

    # The schedule is defined using original-row batches because every sampled
    # epoch retains exactly ``len(train)`` rows. It linearly warms up and then
    # linearly decays over the complete configured training run.
    steps_per_epoch = (len(train) + args.batch_size - 1) // args.batch_size
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        int(args.epochs * steps_per_epoch * args.warmup_ratio),
        args.epochs * steps_per_epoch,
    )

    history = []
    # The rank is a three-value tuple so later values deterministically resolve
    # ties in the primary validation objective.
    best_rank = (-1.0, -1.0, -1.0)

    # Persist input checksums so a saved model can be traced to the exact split
    # files used for the run, even if files are later replaced.
    hashes = {
        name: hashlib.sha256(Path(getattr(args, name)).read_bytes()).hexdigest()
        for name in splits
    }

    for epoch in range(args.epochs):
        started = time.perf_counter()  # Start an accurate wall-clock timer for this epoch.
        model.train()  # Enable dropout and other training-time layer behaviour.

        safe_count = len(train) - risk_count  # Preserve the original epoch row count.
        risk_sample = random.choices(risky_rows, k=risk_count)  # Permit replacement for scarce risk rows.
        safe_sample = (
            random.sample(safe_rows, k=safe_count)
            if safe_count <= len(safe_rows)
            else random.choices(safe_rows, k=safe_count)
        )
        epoch_rows = risk_sample + safe_sample  # Combine the sampled risk and safe populations.
        random.shuffle(epoch_rows)  # Remove class-order patterns before batching.

        total_loss = 0.0  # Accumulate example-weighted loss for the epoch report.
        for start in range(0, len(epoch_rows), args.batch_size):
            rows = epoch_rows[start:start + args.batch_size]

            # The same overlapping-window and max-logit pooling method is used
            # in training and production inference, avoiding train/serve drift.
            encoded, mapping = encode(
                tokenizer,
                [row["text"] for row in rows],
                args.max_length,
                args.stride,
                128,
            )
            optimizer.zero_grad(set_to_none=True)  # Release previous gradients before backpropagation.
            logits = pooled_logits(model, encoded, mapping, len(rows), args.device)
            targets = torch.tensor(
                [row["targets"] for row in rows],
                dtype=torch.float32,
                device=args.device,
            )
            loss = criterion(logits, targets)  # Compare eight predicted logits with eight binary targets.

            # Stop immediately on NaN or infinity rather than saving a corrupted
            # checkpoint or continuing with invalid optimizer updates.
            if not torch.isfinite(loss):
                raise ValueError("Non-finite training loss")
            loss.backward()  # Compute gradients for every trainable parameter.

            # Gradient clipping limits unusually large updates, which is useful
            # when fine-tuning a pretrained transformer on a small data set.
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()  # Apply the AdamW parameter update.
            scheduler.step()  # Advance warm-up or linear decay by one batch.
            total_loss += loss.item() * len(rows)

            # Emit compact progress roughly every 25 batches for long GPU runs.
            if start % (args.batch_size * 25) == 0:
                print(
                    json.dumps(
                        {
                            "epoch": epoch + 1,
                            "rows_done": min(start + len(rows), len(train)),
                            "total": len(epoch_rows),
                            "seconds": round(time.perf_counter() - started, 1),
                        }
                    ),
                    flush=True,
                )

        # Validation determines both per-label thresholds and checkpoint quality.
        # The test split is intentionally absent from this optimization process.
        scores = predict_scores(model, tokenizer, splits["validation"], args)  # Score validation clauses only.
        thresholds, validation = choose_independent_thresholds(
            [row["targets"] for row in splits["validation"]],
            scores,
            args.min_recall,
            args.threshold_beta,
        )
        report = {
            "epoch": epoch + 1,
            "loss": total_loss / len(train),
            "seconds": time.perf_counter() - started,
            "thresholds": thresholds,
            **validation,
        }
        history.append(report)  # Retain every epoch, including non-selected checkpoints.
        print(
            json.dumps(
                {key: value for key, value in report.items() if key != "per_category"}
            ),
            flush=True,
        )

        # Macro-F1 gives equal importance to all eight labels. Macro-F-beta can
        # instead favor precision or recall, depending on ``threshold_beta``.
        # Micro-F1 provides a final deterministic tie-breaker in either mode.
        rank = (
            (validation["macro_f1"], validation["micro_f1"], validation["macro_fbeta"])
            if args.selection_metric == "macro_f1"
            else (validation["macro_fbeta"], validation["macro_f1"], validation["micro_f1"])
        )
        if rank > best_rank:  # Save only when validation ranking genuinely improves.
            best_rank = rank  # Remember the ranking that the next epoch must beat.

            # Save only an improved validation checkpoint. The tokenizer is
            # saved beside the weights so inference is self-contained.
            model.save_pretrained(output, safe_serialization=True)  # Store weights in safe tensor format.
            tokenizer.save_pretrained(output)  # Store matching vocabulary and tokeniser settings.

            # The manifest records everything required to audit the resulting
            # checkpoint: model source, labels, thresholds, data provenance,
            # hyperparameters, runtime details, and validation evidence.
            manifest = {
                "schema_version": 2,
                "status": "trained",
                "task": "multi_label_classification",
                "model_id": (
                    f"BYA-LEGAL-BERT-{model_family}-8-"
                    f"{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
                ),
                "architecture": architecture,
                "base_model": args.base_model_source,
                "revision": args.revision,
                "labels": LABEL_DEFINITIONS,
                "label2id": LABEL2ID,
                "aggregation": "max_logit_per_label",
                "input": "sentence_text_only",
                "decision": "risky if any category score reaches its independent threshold",
                "max_length": args.max_length,
                "stride": args.stride,
                "thresholds": {
                    LABEL_DEFINITIONS[index]["id"]: thresholds[index]
                    for index in range(8)
                },
                "review_margin": args.review_margin,
                "score_note": (
                    "Independent sigmoid scores; uncalibrated and not legal-risk probabilities"
                ),
                "experimental": False,
                "label_sources": ["public_dataset"],
                "dataset_revisions": sorted(
                    {
                        row["dataset_revision"]
                        for split_rows in splits.values()
                        for row in split_rows
                    }
                ),
                "training_data": {
                    "dataset": "coastalcph/lex_glue",
                    "subset": "unfair_tos",
                    "source_url": "https://huggingface.co/datasets/coastalcph/lex_glue",
                    "license": "CC-BY-4.0",
                    "annotation": "Original eight expert-created UNFAIR-ToS labels",
                },
                "training_args": vars(args),
                "positive_class_weights": pos_weight.cpu().tolist(),
                "environment": {
                    "python": platform.python_version(),
                    "torch": torch.__version__,
                    "device": args.device,
                    "cuda_runtime": torch.version.cuda,
                    "gpu": (
                        torch.cuda.get_device_name()
                        if args.device.startswith("cuda")
                        else None
                    ),
                    "precision": "float32",
                    "threads": args.threads,
                },
                "data_audit": audit,
                "split_file_sha256": hashes,
                "group_hashes": {
                    name: [
                        hashlib.sha256(group.encode()).hexdigest()
                        for group in sorted(
                            {row["group"] for row in split_rows if row["group"]}
                        )
                    ]
                    for name, split_rows in splits.items()
                },
                "text_hashes": {
                    name: [row["hash"] for row in split_rows]
                    for name, split_rows in splits.items()
                },
                "validation": report,
            }
            (output / "risk_config.json").write_text(
                json.dumps(manifest, indent=2),
                encoding="utf-8",
            )

        # Keep the full curve even when a later epoch is not selected. This is
        # necessary to inspect learning progress and potential overfitting.
        (output / "training_history.json").write_text(
            json.dumps(history, indent=2),
            encoding="utf-8",
        )

    print(
        f"Saved validation-selected model to {output}. "
        "Evaluate exactly once on the held-out test split."
    )


if __name__ == "__main__":
    main()
