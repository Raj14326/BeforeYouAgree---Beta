"""Evaluate with the saved threshold; export errors without retuning on test."""
import argparse
import csv
import hashlib
import json
import time
import torch
from pathlib import Path

from .data import metrics, read_rows
from .model import RiskModel


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="ml/models/bert-risk")
    parser.add_argument("--test", required=True)
    parser.add_argument("--output", default="ml/reports/bert-test")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--allow-weak-labels", action="store_true")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()
    torch.set_num_threads(args.threads)
    rows = read_rows(args.test, args.allow_weak_labels)
    model = RiskModel(args.model, args.device, args.allow_weak_labels)
    manifest = model.manifest
    used_text = set(manifest["text_hashes"]["train"] + manifest["text_hashes"]["validation"])
    used_groups = set(manifest["group_hashes"]["train"] + manifest["group_hashes"]["validation"])
    if any(r["hash"] in used_text or hashlib.sha256(r["group"].encode()).hexdigest() in used_groups for r in rows):
        raise ValueError("Evaluation data overlaps training/validation text or groups")
    scores = []
    started = time.perf_counter()
    for start in range(0, len(rows), 8):
        response = model.predict([{"clauseId": str(i), "text": r["text"]}
                                  for i, r in enumerate(rows[start:start + 8])])
        scores.extend(f["riskProbability"] for f in response["findings"])
    report = {"model": manifest["model_id"], "threshold": manifest["threshold"],
              "experimental": manifest["experimental"] or any(not r["trusted"] for r in rows),
              "test_sha256": hashlib.sha256(Path(args.test).read_bytes()).hexdigest(),
              "seconds": time.perf_counter() - started, "rows": len(rows),
              **metrics([r["label"] for r in rows], scores, manifest["threshold"])}
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with (output / "predictions.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["clause_id", "text", "actual", "predicted", "score", "error"])
        writer.writeheader()
        for row, score in zip(rows, scores):
            predicted = int(score >= manifest["threshold"])
            writer.writerow({"clause_id": row["id"], "text": row["text"], "actual": row["label"],
                             "predicted": predicted, "score": score,
                             "error": "false_positive" if predicted > row["label"] else
                                      "false_negative" if predicted < row["label"] else ""})
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
