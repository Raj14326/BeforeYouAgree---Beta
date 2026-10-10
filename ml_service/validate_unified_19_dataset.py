"""Validate schema, label coverage, deduplication, and group isolation."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


def key(text: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()
    return hashlib.sha256(normalized.encode()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("dataset", nargs="?", type=Path, default=Path("ml/data/bya-19-v1"))
    args = parser.parse_args()
    manifest = json.loads((args.dataset / "dataset_manifest.json").read_text(encoding="utf-8"))
    labels = manifest["labels"]
    label_set = set(labels)
    seen_text: dict[str, str] = {}
    ota_groups: dict[str, set[str]] = defaultdict(set)
    counts: dict[str, Counter] = {}
    errors = []

    if "OPP-115" not in manifest.get("excluded_sources", []):
        errors.append("manifest must explicitly exclude OPP-115")

    for split in ("train", "validation", "test"):
        counter = Counter()
        path = args.dataset / f"{split}.jsonl"
        for line_number, line in enumerate(path.open(encoding="utf-8"), 1):
            row = json.loads(line)
            where = f"{path.name}:{line_number}"
            if row["split"] != split:
                errors.append(f"{where}: embedded split mismatch")
            unknown = set(row["labels"]) - label_set
            if unknown:
                errors.append(f"{where}: unknown labels {sorted(unknown)}")
            expected = [int(label in row["labels"]) for label in labels]
            if row["label_vector"] != expected:
                errors.append(f"{where}: label vector mismatch")
            digest = key(row["text"])
            if digest in seen_text:
                errors.append(f"{where}: duplicate text also in {seen_text[digest]}")
            seen_text[digest] = where
            if row["source"] == "OpenTermsArchive/contrib-versions":
                ota_groups[row["service"].lower()].add(split)
            if "opp-115" in json.dumps(row).lower():
                errors.append(f"{where}: forbidden OPP-115 provenance")
            counter.update(row["labels"])
        counts[split] = counter

    for service, splits in ota_groups.items():
        if len(splits) > 1:
            errors.append(f"Open Terms Archive service leaks across splits: {service} -> {sorted(splits)}")
    for label in labels:
        if counts["train"][label] < 20:
            errors.append(f"{label}: fewer than 20 training positives")
        if counts["validation"][label] < 3 or counts["test"][label] < 3:
            errors.append(f"{label}: fewer than 3 positives in validation or test")

    report = {
        "valid": not errors,
        "rows": len(seen_text),
        "ota_groups": len(ota_groups),
        "label_counts": {
            label: {split: counts[split][label] for split in counts} for label in labels
        },
        "errors": errors[:100],
    }
    print(json.dumps(report, indent=2))
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
