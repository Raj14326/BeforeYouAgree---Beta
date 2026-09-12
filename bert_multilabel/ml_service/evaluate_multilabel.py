"""One-time held-out evaluation using validation-selected category thresholds."""
import argparse
import csv
import hashlib
import json
import time
from pathlib import Path

import torch

from .model import RiskModel
from .multilabel_data import LABEL_DEFINITIONS, multilabel_metrics, read_multilabel_rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", default="ml/models/bert-multilabel-base-v1")
    parser.add_argument("--test", required=True)
    parser.add_argument("--output", default="ml/reports/bert-multilabel-base-test")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--threads", type=int, default=8)
    args = parser.parse_args()
    torch.set_num_threads(args.threads)
    rows = read_multilabel_rows(args.test)
    model = RiskModel(args.model, args.device)
    m = model.manifest
    if m.get("schema_version") != 2:
        raise ValueError("A schema-version 2 multi-label checkpoint is required")
    used_text = set(m["text_hashes"]["train"] + m["text_hashes"]["validation"])
    if any(row["hash"] in used_text for row in rows):
        raise ValueError("Test text overlaps training/validation")
    all_scores = []
    started = time.perf_counter()
    for start in range(0, len(rows), 16):
        batch = rows[start:start + 16]
        response = model.predict([{"clauseId": row["id"], "text": row["text"]} for row in batch])
        all_scores.extend([[category["score"] for category in finding["categories"]]
                           for finding in response["findings"]])
    thresholds = [m["thresholds"][item["id"]] for item in LABEL_DEFINITIONS]
    report = {"model": m["model_id"], "rows": len(rows), "seconds": time.perf_counter() - started,
              "test_sha256": hashlib.sha256(Path(args.test).read_bytes()).hexdigest(),
              **multilabel_metrics([row["targets"] for row in rows], all_scores, thresholds)}
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    (output / "metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with (output / "predictions.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["clause_id", "text", "actual_categories", "predicted_categories", "scores"])
        writer.writeheader()
        for row, scores in zip(rows, all_scores):
            predicted = [LABEL_DEFINITIONS[i]["id"] for i, score in enumerate(scores) if score >= thresholds[i]]
            actual = [LABEL_DEFINITIONS[i]["id"] for i in row["label_ids"]]
            writer.writerow({"clause_id": row["id"], "text": row["text"],
                             "actual_categories": json.dumps(actual), "predicted_categories": json.dumps(predicted),
                             "scores": json.dumps({LABEL_DEFINITIONS[i]["id"]: value for i, value in enumerate(scores)})})
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
