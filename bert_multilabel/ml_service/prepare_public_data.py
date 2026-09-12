"""Import versioned LexGLUE UNFAIR-ToS annotations without relabelling by AI."""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from pathlib import Path

import pyarrow.parquet as pq
from huggingface_hub import hf_hub_download

from .data import fingerprint

REVISION = "c23fdff1a6bf74e0e1a71cb86f1e781d37da888c"


def prepare(raw, output, revision=REVISION, download=True):
    output = Path(output)
    if output.exists() and any(output.iterdir()):
        raise ValueError("Choose an empty output directory")
    raw = Path(raw)
    all_rows = defaultdict(list)
    original_counts = {}
    raw_hashes = {}
    for split in ("train", "validation", "test"):
        name = f"unfair_tos/{split}-00000-of-00001.parquet"
        path = Path(hf_hub_download("coastalcph/lex_glue", name, repo_type="dataset", revision=revision,
                                   local_dir=raw)) if download else raw / name
        raw_hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        rows = pq.read_table(path).to_pylist()
        original_counts[split] = len(rows)
        for index, row in enumerate(rows):
            text, labels = row["text"].strip(), row["labels"]
            if not text or not isinstance(labels, list) or any(type(x) is not int or not 0 <= x < 8 for x in labels):
                raise ValueError(f"Unexpected source schema at {split}:{index}")
            all_rows[fingerprint(text)].append({"text": text, "label": "risky" if labels else "not_risky",
                                               "clause_id": f"{split}:{index}", "original_split": split,
                                               "original_labels": json.dumps(labels), "label_source": "public_dataset",
                                               "dataset_revision": revision})
    # Fixed label-independent split precedence protects held-out examples.
    # Ambiguous duplicate binary labels are excluded from ALL sets and reported.
    priority = {"test": 0, "validation": 1, "train": 2}
    selected = {split: [] for split in original_counts}
    removed = Counter()
    conflicts = []
    for key, occurrences in all_rows.items():
        if len({r['label'] for r in occurrences}) > 1:
            conflicts.append({"text_hash": key, "ids": [r['clause_id'] for r in occurrences]})
            for row in occurrences:
                removed[f"{row['original_split']}:conflicting_label"] += 1
            continue
        keep = min(occurrences, key=lambda row: priority[row['original_split']])
        selected[keep['original_split']].append(keep)
        for row in occurrences:
            if row is not keep:
                removed[f"{row['original_split']}:duplicate"] += 1
    output.mkdir(parents=True, exist_ok=True)
    files = {}
    for split, rows in selected.items():
        rows.sort(key=lambda row: int(row['clause_id'].split(':')[1]))
        path = output / f"{split}.csv"
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
        files[path.name] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "rows": len(rows),
                            "risky": sum(r['label'] == 'risky' for r in rows)}
    manifest = {"schema_version": 1, "dataset": "coastalcph/lex_glue", "subset": "unfair_tos",
                "revision": revision, "source_url": "https://huggingface.co/datasets/coastalcph/lex_glue",
                "license_from_dataset_card": "CC-BY-4.0", "label_source": "original_public_annotations",
                "mapping": "nonempty labels => risky; empty => not_risky within the eight-category scope",
                "split_policy": "official split membership; exact duplicates deduplicated test > validation > train; binary conflicts removed",
                "group_limit": "No document/service IDs supplied in this parquet release; official split retained, independent group audit unavailable",
                "raw_sha256": raw_hashes, "original_counts": original_counts, "removed": dict(removed),
                "conflicts": conflicts, "files": files}
    (output / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps({"original": original_counts, "prepared": files, "removed": dict(removed)}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", default="ml/data/lexglue-raw")
    parser.add_argument("--output", default="ml/data/lexglue-binary")
    parser.add_argument("--revision", default=REVISION)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    prepare(args.raw, args.output, args.revision, not args.offline)
