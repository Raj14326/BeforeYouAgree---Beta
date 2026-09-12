"""Offline fine-tuning. Select epoch/threshold on validation only, never test."""
import argparse
import hashlib
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer, set_seed

from .data import LABELS, audit_splits, choose_threshold, read_rows
from .model import encode, pooled_logits


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", required=True)
    parser.add_argument("--validation", required=True)
    parser.add_argument("--test", required=True, help="Only audited for leakage; evaluated separately")
    parser.add_argument("--base-model", default="nlpaueb/legal-bert-base-uncased")
    parser.add_argument("--base-model-source", help="Canonical model ID when --base-model is a local cache")
    parser.add_argument("--revision", default="main", help="Use a commit hash for reproducible downloads")
    parser.add_argument("--output", default="ml/models/bert-risk")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--stride", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--min-recall", type=float, default=0.7)
    parser.add_argument("--review-margin", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=5120)
    parser.add_argument("--device", default="cuda" if torch.cuda.is_available() else "cpu")
    parser.add_argument("--allow-weak-labels", action="store_true")
    parser.add_argument("--threads", type=int, default=8)
    parser.add_argument("--freeze-encoder", action="store_true", help="Optional feature-extractor baseline, not full fine-tuning")
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or args.learning_rate <= 0:
        parser.error("epochs, batch-size and learning-rate must be positive")
    if not 0 < args.min_recall <= 1 or not 0 <= args.review_margin < 0.5:
        parser.error("Invalid recall target or review margin")
    splits = {name: read_rows(getattr(args, name), args.allow_weak_labels)
              for name in ("train", "validation", "test")}
    audit = audit_splits(splits)
    output = Path(args.output)
    if output.exists() and any(output.iterdir()):
        raise ValueError("Output is not empty; choose a new model directory to preserve previous runs")
    set_seed(args.seed)
    torch.set_num_threads(args.threads)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, revision=args.revision)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.base_model, revision=args.revision, num_labels=2,
        id2label={0: "not_risky", 1: "risky"}, label2id=LABELS)
    if not 8 <= args.max_length <= model.config.max_position_embeddings:
        parser.error("max-length exceeds model capacity")
    if not 0 <= args.stride < args.max_length - tokenizer.num_special_tokens_to_add():
        parser.error("stride must be smaller than the usable token window")
    model.to(args.device)
    if args.freeze_encoder:
        for parameter in model.base_model.parameters():
            parameter.requires_grad = False
    train = splits["train"]
    counts = [sum(row["label"] == label for row in train) for label in (0, 1)]
    weights = torch.tensor([len(train) / (2 * count) for count in counts], device=args.device)
    optimizer = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=args.learning_rate, weight_decay=0.01)
    best = (-1.0, -1.0)
    history = []
    output.mkdir(parents=True, exist_ok=True)
    hashes = {name: hashlib.sha256(Path(getattr(args, name)).read_bytes()).hexdigest() for name in splits}
    for epoch in range(args.epochs):
        epoch_started = time.perf_counter()
        model.train()
        random.shuffle(train)
        loss_total = 0.0
        for start in range(0, len(train), args.batch_size):
            rows = train[start:start + args.batch_size]
            encoded, mapping = encode(tokenizer, [r["text"] for r in rows], args.max_length, args.stride, 128)
            optimizer.zero_grad(set_to_none=True)
            logits = pooled_logits(model, encoded, mapping, len(rows), args.device)
            labels = torch.tensor([r["label"] for r in rows], device=args.device)
            loss = torch.nn.functional.cross_entropy(logits, labels, weight=weights)
            if not torch.isfinite(loss):
                raise ValueError("Non-finite training loss; model was not saved for this epoch")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            loss_total += loss.item() * len(rows)
            if start % (args.batch_size * 25) == 0:
                print(json.dumps({"epoch": epoch + 1, "clauses_done": start + len(rows), "total": len(train),
                                  "seconds": round(time.perf_counter() - epoch_started, 1)}), flush=True)
        model.eval()
        scores = []
        with torch.inference_mode():
            for start in range(0, len(splits["validation"]), args.batch_size):
                rows = splits["validation"][start:start + args.batch_size]
                encoded, mapping = encode(tokenizer, [r["text"] for r in rows], args.max_length, args.stride, 128)
                logits = pooled_logits(model, encoded, mapping, len(rows), args.device)
                scores.extend(logits.softmax(-1)[:, 1].cpu().tolist())
        threshold, validation = choose_threshold([r["label"] for r in splits["validation"]], scores, args.min_recall)
        report = {"epoch": epoch + 1, "loss": loss_total / len(train), "threshold": threshold, **validation}
        history.append(report)
        print(json.dumps(report), flush=True)
        rank = (validation["risky_precision"], validation["macro_f1"])
        if rank > best:
            best = rank
            model.save_pretrained(output, safe_serialization=True)
            tokenizer.save_pretrained(output)
            manifest = {"schema_version": 1, "status": "trained",
                        "model_id": f"BYA-BERT-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}",
                        "base_model": args.base_model, "revision": args.revision,
                        "base_model_source": args.base_model_source or args.base_model,
                        "resolved_revision": getattr(model.config, "_commit_hash", None),
                        "label2id": LABELS, "aggregation": "max_logit", "input": "clause_text_only",
                        "max_length": args.max_length, "stride": args.stride,
                        "threshold": threshold, "review_margin": args.review_margin,
                        "score_note": "Uncalibrated model score, not a legal-risk probability",
                        "experimental": any(not r["trusted"] for rows in splits.values() for r in rows),
                        "label_sources": sorted({r['label_source'] for rows in splits.values() for r in rows}),
                        "dataset_revisions": sorted({r['dataset_revision'] for rows in splits.values() for r in rows if r['dataset_revision']}),
                        "training_data": {"dataset": "coastalcph/lex_glue", "subset": "unfair_tos",
                                          "source_url": "https://huggingface.co/datasets/coastalcph/lex_glue",
                                          "license": "CC-BY-4.0",
                                          "label_mapping": "any of eight UNFAIR-ToS labels => risky; empty labels => not_risky"}
                                         if set(r['label_source'] for rows in splits.values() for r in rows) == {"public_dataset"}
                                         else None,
                        "training_args": vars(args), "data_audit": audit, "split_file_sha256": hashes,
                        "group_hashes": {name: [hashlib.sha256(g.encode()).hexdigest()
                                          for g in sorted({r['group'] for r in rows if r['group']})] for name, rows in splits.items()},
                        "text_hashes": {name: [r['hash'] for r in rows] for name, rows in splits.items()},
                        "validation": report}
            (output / "risk_config.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        (output / "training_history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    print(f"Saved validation-selected model to {output}. Run evaluate before deployment.")


if __name__ == "__main__":
    main()
