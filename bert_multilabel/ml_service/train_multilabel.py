"""Fine-tune LEGAL-BERT-Base for native eight-label UNFAIR-ToS classification."""
import argparse
import hashlib
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup, set_seed

from .model import encode, pooled_logits
from .multilabel_data import (ID2LABEL, LABEL2ID, LABEL_DEFINITIONS,
                              audit_multilabel_splits, choose_independent_thresholds,
                              read_multilabel_rows)


def predict_scores(model, tokenizer, rows, args):
    scores = []
    model.eval()
    with torch.inference_mode():
        for start in range(0, len(rows), args.batch_size):
            batch = rows[start:start + args.batch_size]
            encoded, mapping = encode(tokenizer, [r["text"] for r in batch], args.max_length, args.stride, 128)
            logits = pooled_logits(model, encoded, mapping, len(batch), args.device)
            scores.extend(torch.sigmoid(logits).cpu().tolist())
    return scores


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("train", "validation", "test"):
        parser.add_argument(f"--{name}", required=True)
    parser.add_argument("--base-model", default="nlpaueb/legal-bert-base-uncased")
    parser.add_argument("--base-model-source", default="nlpaueb/legal-bert-base-uncased")
    parser.add_argument("--revision", default="15b570cbf88259610b082a167dacc190124f60f6")
    parser.add_argument("--output", default="ml/models/bert-multilabel-base-v1")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--max-length", type=int, default=128)
    parser.add_argument("--stride", type=int, default=32)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--head-learning-rate", type=float, default=1e-4)
    parser.add_argument("--max-pos-weight", type=float, default=20.0)
    parser.add_argument("--warmup-ratio", type=float, default=0.1)
    parser.add_argument("--min-recall", type=float, default=0.70)
    parser.add_argument("--review-margin", type=float, default=0.08)
    parser.add_argument("--seed", type=int, default=5120)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.threads < 1:
        parser.error("epochs, batch-size and threads must be positive")

    splits = {name: read_multilabel_rows(getattr(args, name)) for name in ("train", "validation", "test")}
    audit = audit_multilabel_splits(splits)
    output = Path(args.output)
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output is not empty; choose a new directory")
    output.mkdir(parents=True, exist_ok=True)
    set_seed(args.seed)
    torch.set_num_threads(args.threads)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, revision=args.revision, local_files_only=Path(args.base_model).exists())
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model, revision=args.revision, local_files_only=Path(args.base_model).exists(),
        num_labels=8, label2id=LABEL2ID, id2label=ID2LABEL,
        problem_type="multi_label_classification", ignore_mismatched_sizes=True)
    if not 8 <= args.max_length <= model.config.max_position_embeddings:
        parser.error("max-length exceeds model capacity")
    model.to(args.device)
    train = splits["train"]
    risky_rows = [row for row in train if any(row["targets"])]
    safe_rows = [row for row in train if not any(row["targets"])]
    # Each epoch uses a 50/50 risky/safe sample. This avoids the unstable
    # 28-191x weights produced by the raw prevalence while validation keeps
    # the real deployment prevalence for threshold selection.
    sampled_positive_rate = torch.tensor([
        0.5 * sum(row["targets"][j] for row in risky_rows) / len(risky_rows) for j in range(8)
    ], device=args.device)
    pos_weight = torch.clamp((1 - sampled_positive_rate) / sampled_positive_rate, max=args.max_pos_weight)
    classifier_ids = {id(parameter) for parameter in model.classifier.parameters()}
    optimizer = torch.optim.AdamW([
        {"params": [p for p in model.parameters() if id(p) not in classifier_ids], "lr": args.learning_rate},
        {"params": list(model.classifier.parameters()), "lr": args.head_learning_rate},
    ], weight_decay=0.01)
    criterion = torch.nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    steps_per_epoch = (len(train) + args.batch_size - 1) // args.batch_size
    scheduler = get_linear_schedule_with_warmup(
        optimizer, int(args.epochs * steps_per_epoch * args.warmup_ratio), args.epochs * steps_per_epoch)
    history, best_rank = [], (-1.0, -1.0)
    hashes = {name: hashlib.sha256(Path(getattr(args, name)).read_bytes()).hexdigest() for name in splits}

    for epoch in range(args.epochs):
        started = time.perf_counter()
        model.train()
        half = len(train) // 2
        epoch_rows = random.choices(risky_rows, k=half) + random.sample(safe_rows, k=len(train) - half)
        random.shuffle(epoch_rows)
        total_loss = 0.0
        for start in range(0, len(epoch_rows), args.batch_size):
            rows = epoch_rows[start:start + args.batch_size]
            encoded, mapping = encode(tokenizer, [r["text"] for r in rows], args.max_length, args.stride, 128)
            optimizer.zero_grad(set_to_none=True)
            logits = pooled_logits(model, encoded, mapping, len(rows), args.device)
            targets = torch.tensor([r["targets"] for r in rows], dtype=torch.float32, device=args.device)
            loss = criterion(logits, targets)
            if not torch.isfinite(loss):
                raise ValueError("Non-finite training loss")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            total_loss += loss.item() * len(rows)
            if start % (args.batch_size * 25) == 0:
                print(json.dumps({"epoch": epoch + 1, "rows_done": min(start + len(rows), len(train)),
                                  "total": len(epoch_rows), "seconds": round(time.perf_counter() - started, 1)}), flush=True)
        scores = predict_scores(model, tokenizer, splits["validation"], args)
        thresholds, validation = choose_independent_thresholds(
            [r["targets"] for r in splits["validation"]], scores, args.min_recall)
        report = {"epoch": epoch + 1, "loss": total_loss / len(train),
                  "seconds": time.perf_counter() - started, "thresholds": thresholds, **validation}
        history.append(report)
        print(json.dumps({k: v for k, v in report.items() if k != "per_category"}), flush=True)
        rank = (validation["macro_f1"], validation["micro_f1"])
        if rank > best_rank:
            best_rank = rank
            model.save_pretrained(output, safe_serialization=True)
            tokenizer.save_pretrained(output)
            manifest = {
                "schema_version": 2, "status": "trained", "task": "multi_label_classification",
                "model_id": f"BYA-LEGAL-BERT-BASE-8-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                "architecture": "LEGAL-BERT-Base", "base_model": args.base_model_source,
                "revision": args.revision, "labels": LABEL_DEFINITIONS, "label2id": LABEL2ID,
                "aggregation": "max_logit_per_label", "input": "sentence_text_only",
                "decision": "risky if any category score reaches its independent threshold",
                "max_length": args.max_length, "stride": args.stride,
                "thresholds": {LABEL_DEFINITIONS[i]["id"]: thresholds[i] for i in range(8)},
                "review_margin": args.review_margin,
                "score_note": "Independent sigmoid scores; uncalibrated and not legal-risk probabilities",
                "experimental": False, "label_sources": ["public_dataset"],
                "dataset_revisions": sorted({r["dataset_revision"] for rows in splits.values() for r in rows}),
                "training_data": {"dataset": "coastalcph/lex_glue", "subset": "unfair_tos",
                    "source_url": "https://huggingface.co/datasets/coastalcph/lex_glue",
                    "license": "CC-BY-4.0", "annotation": "Original eight expert-created UNFAIR-ToS labels"},
                "training_args": vars(args), "positive_class_weights": pos_weight.cpu().tolist(),
                "data_audit": audit, "split_file_sha256": hashes,
                "group_hashes": {name: [hashlib.sha256(g.encode()).hexdigest() for g in sorted({r['group'] for r in rows if r['group']})] for name, rows in splits.items()},
                "text_hashes": {name: [r["hash"] for r in rows] for name, rows in splits.items()},
                "validation": report,
            }
            (output / "risk_config.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        (output / "training_history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    print(f"Saved validation-selected model to {output}. Evaluate exactly once on the held-out test split.")


if __name__ == "__main__":
    main()
