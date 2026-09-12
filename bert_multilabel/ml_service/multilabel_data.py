"""UNFAIR-ToS eight-label loading, validation metrics and threshold tuning."""
import csv
import json

from .data import audit_splits, read_rows


LABEL_DEFINITIONS = [
    {"id": "limitation_of_liability", "name": "Limitation of liability"},
    {"id": "unilateral_termination", "name": "Unilateral termination"},
    {"id": "unilateral_change", "name": "Unilateral change"},
    {"id": "content_removal", "name": "Content removal"},
    {"id": "contract_by_using", "name": "Contract by using"},
    {"id": "choice_of_law", "name": "Choice of law"},
    {"id": "jurisdiction", "name": "Jurisdiction"},
    {"id": "arbitration", "name": "Arbitration"},
]
LABEL2ID = {item["id"]: index for index, item in enumerate(LABEL_DEFINITIONS)}
ID2LABEL = {index: item["id"] for index, item in enumerate(LABEL_DEFINITIONS)}


def read_multilabel_rows(path, allow_weak=False):
    """Reuse provenance/checksum checks, then restore the eight original labels."""
    rows = read_rows(path, allow_weak)
    with open(path, encoding="utf-8-sig", newline="") as handle:
        source = {row.get("clause_id"): row for row in csv.DictReader(handle)}
    for row in rows:
        try:
            labels = json.loads(source[row["id"]]["original_labels"])
        except (KeyError, TypeError, json.JSONDecodeError) as exc:
            raise ValueError(f"{path}: missing valid original_labels for {row['id']}") from exc
        if (not isinstance(labels, list) or any(type(x) is not int or x < 0 or x >= len(LABEL_DEFINITIONS) for x in labels)
                or len(labels) != len(set(labels))):
            raise ValueError(f"{path}: invalid eight-label annotation for {row['id']}")
        row["label_ids"] = sorted(labels)
        row["targets"] = [float(i in labels) for i in range(len(LABEL_DEFINITIONS))]
    return rows


def audit_multilabel_splits(splits):
    audit = audit_splits(splits)
    for name, rows in splits.items():
        audit[name]["category_positives"] = {
            LABEL_DEFINITIONS[i]["id"]: sum(i in row["label_ids"] for row in rows)
            for i in range(len(LABEL_DEFINITIONS))
        }
        audit[name]["multi_label_rows"] = sum(len(row["label_ids"]) > 1 for row in rows)
    return audit


def binary_metrics(labels, predictions):
    tp = sum(y and p for y, p in zip(labels, predictions))
    fp = sum(not y and p for y, p in zip(labels, predictions))
    fn = sum(y and not p for y, p in zip(labels, predictions))
    tn = sum(not y and not p for y, p in zip(labels, predictions))
    divide = lambda a, b: a / b if b else 0.0
    return {"precision": divide(tp, tp + fp), "recall": divide(tp, tp + fn),
            "f1": divide(2 * tp, 2 * tp + fp + fn),
            "false_positive_rate": divide(fp, fp + tn),
            "accuracy": divide(tp + tn, len(labels)),
            "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn}}


def multilabel_metrics(targets, scores, thresholds):
    predictions = [[score >= thresholds[j] for j, score in enumerate(row)] for row in scores]
    per_category = {}
    f1s = []
    total_tp = total_fp = total_fn = 0
    for j, definition in enumerate(LABEL_DEFINITIONS):
        actual = [bool(row[j]) for row in targets]
        predicted = [row[j] for row in predictions]
        m = binary_metrics(actual, predicted)
        per_category[definition["id"]] = {**m, "threshold": thresholds[j],
                                           "positives": sum(actual)}
        f1s.append(m["f1"])
        total_tp += m["confusion"]["tp"]
        total_fp += m["confusion"]["fp"]
        total_fn += m["confusion"]["fn"]
    divide = lambda a, b: a / b if b else 0.0
    exact = sum(all(bool(a) == p for a, p in zip(y, pred)) for y, pred in zip(targets, predictions)) / len(targets)
    risky = binary_metrics([any(row) for row in targets], [any(row) for row in predictions])
    return {"macro_f1": sum(f1s) / len(f1s),
            "micro_precision": divide(total_tp, total_tp + total_fp),
            "micro_recall": divide(total_tp, total_tp + total_fn),
            "micro_f1": divide(2 * total_tp, 2 * total_tp + total_fp + total_fn),
            "exact_match": exact, "per_category": per_category, "derived_binary_risk": risky}


def choose_independent_thresholds(targets, scores, min_recall=0.70):
    """Tune each label on validation only; rank by F1, then precision."""
    thresholds = []
    for j in range(len(LABEL_DEFINITIONS)):
        actual = [bool(row[j]) for row in targets]
        candidates = sorted(set(row[j] for row in scores))
        ranked = []
        for threshold in candidates:
            m = binary_metrics(actual, [row[j] >= threshold for row in scores])
            if m["recall"] >= min_recall:
                ranked.append((m["f1"], m["precision"], threshold))
        if not ranked:
            raise ValueError(f"No validation threshold meets recall target for label {j}")
        thresholds.append(max(ranked)[2])
    return thresholds, multilabel_metrics(targets, scores, thresholds)
