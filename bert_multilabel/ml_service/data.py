"""CSV input and leakage checks. No model dependencies needed for auditing."""
import csv
import hashlib
import json
from pathlib import Path

LABELS = {"not_risky": 0, "risky": 1}


def fingerprint(text):
    return hashlib.sha256(" ".join(text.lower().split()).encode()).hexdigest()


def read_rows(path, allow_weak=False):
    path = Path(path)
    public = None
    manifest_path = path.parent / "dataset_manifest.json"
    if manifest_path.exists():
        candidate = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected = candidate.get("files", {}).get(path.name, {}).get("sha256")
        if expected:
            if expected != hashlib.sha256(path.read_bytes()).hexdigest():
                raise ValueError(f"{path}: public dataset checksum mismatch; re-import instead of changing provenance")
            if candidate.get("dataset") != "coastalcph/lex_glue" or candidate.get("subset") != "unfair_tos":
                raise ValueError("Unrecognized public dataset provenance")
            public = candidate
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        source = list(csv.DictReader(handle))
    rows = []
    seen = set()
    for number, row in enumerate(source, 2):
        text = (row.get("text") or row.get("clause_text_clean") or "").strip()
        label = row.get("label") or row.get("binary_label")
        group = (row.get("service_name") or row.get("document_id") or row.get("document_ID") or "").strip().lower()
        if not text or label not in LABELS or (not group and not public):
            raise ValueError(f"{path}:{number}: need text, risky/not_risky label and service_name or document_id")
        # Explicit provenance is required; an AI-generated 'reviewed' column is not human review.
        human = row.get("human_reviewed", "").strip().lower() == "true"
        if not human and not public and not allow_weak:
            raise ValueError(f"{path}:{number}: human_reviewed=true required; use --allow-weak-labels only for exploratory runs")
        key = fingerprint(text)
        if key in seen:
            raise ValueError(f"{path}:{number}: duplicate clause text; deduplicate before training")
        seen.add(key)
        rows.append({"text": text, "label": LABELS[label], "group": group,
                     "id": row.get("clause_id") or str(number), "hash": key, "human": human,
                     "trusted": human or bool(public),
                     "label_source": "public_dataset" if public else "human" if human else "weak",
                     "dataset_revision": public["revision"] if public else None})
    if not rows or {r["label"] for r in rows} != {0, 1}:
        raise ValueError(f"{path}: both classes must be represented")
    return rows


def audit_splits(splits):
    names = list(splits)
    for index, left in enumerate(names):
        for right in names[index + 1:]:
            for key in ("group", "hash"):
                overlap = {r[key] for r in splits[left] if r[key]} & {r[key] for r in splits[right] if r[key]}
                if overlap:
                    raise ValueError(f"{left}/{right}: {len(overlap)} overlapping {key} values; rebuild grouped splits")
    return {name: {"rows": len(rows), "groups": len({r['group'] for r in rows if r['group']}),
                   "group_ids_available": all(bool(r['group']) for r in rows),
                   "risky": sum(r['label'] for r in rows),
                   "public_dataset_labels": sum(r.get('label_source') == 'public_dataset' for r in rows),
                   "human_reviewed": sum(r['human'] for r in rows)} for name, rows in splits.items()}


def metrics(labels, scores, threshold):
    tp = int(sum(y == 1 and p >= threshold for y, p in zip(labels, scores)))
    fp = int(sum(y == 0 and p >= threshold for y, p in zip(labels, scores)))
    fn = int(sum(y == 1 and p < threshold for y, p in zip(labels, scores)))
    tn = int(sum(y == 0 and p < threshold for y, p in zip(labels, scores)))
    divide = lambda a, b: a / b if b else 0.0
    return {"risky_precision": divide(tp, tp + fp), "risky_recall": divide(tp, tp + fn),
            "macro_f1": (divide(2 * tp, 2 * tp + fp + fn) + divide(2 * tn, 2 * tn + fp + fn)) / 2,
            "false_positive_rate": divide(fp, fp + tn), "accuracy": divide(tp + tn, len(labels)),
            "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn}}


def choose_threshold(labels, scores, min_recall):
    candidates = [(t, metrics(labels, scores, t)) for t in sorted(set(scores)) if 0 < t < 1]
    eligible = [(t, m) for t, m in candidates if m["risky_recall"] >= min_recall]
    if not eligible:
        raise ValueError("No threshold meets minimum validation recall; inspect the model/data")
    return max(eligible, key=lambda pair: (pair[1]["risky_precision"], pair[1]["macro_f1"]))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    for name in ("train", "validation", "test"):
        parser.add_argument(f"--{name}", required=True)
    parser.add_argument("--allow-weak-labels", action="store_true")
    args = parser.parse_args()
    splits = {name: read_rows(getattr(args, name), args.allow_weak_labels) for name in ("train", "validation", "test")}
    print(json.dumps(audit_splits(splits), indent=2))
