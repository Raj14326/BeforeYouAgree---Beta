import csv
import json
import math
import re
import shutil
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path


LABELS = ["not_risky", "risky"]

DATA_DIR = Path.home() / "Desktop" / "新建文件夹" / "clean_data"
TRAIN_PATH = DATA_DIR / "ota_clean_training_binary.csv"
VAL_PATH = DATA_DIR / "ota_clean_validation_binary.csv"
TEST_PATH = DATA_DIR / "ota_clean_test_binary.csv"
OUTPUT_ROOT = Path.home() / "Desktop" / "新建文件夹" / "trained_models"


RISK_PATTERNS = {
    "data_sharing": [
        r"\bshare\b.*\b(third[- ]?part|partner|affiliate|advertis)",
        r"\bthird[- ]?part(y|ies)\b",
        r"\baffiliate(s)?\b",
        r"\badvertis(ing|er|ers|ement)\b",
    ],
    "tracking": [
        r"\btrack(ing|s|ed)?\b",
        r"\bcookie(s)?\b",
        r"\bidentifier(s)?\b",
        r"\bdevice information\b",
        r"\blocation data\b",
    ],
    "content_license": [
        r"\bworldwide\b.*\blicen[cs]e\b",
        r"\birrevocable\b",
        r"\broyalty[- ]?free\b",
        r"\buser content\b",
        r"\btrain\b.*\b(ai|model|algorithm)",
    ],
    "liability_dispute": [
        r"\barbitration\b",
        r"\bclass[- ]?action\b",
        r"\bliability\b",
        r"\bwaiver\b",
        r"\bindemnif(y|ication)\b",
    ],
    "billing_refund": [
        r"\bauto[- ]?renew(al|s)?\b",
        r"\bsubscription\b",
        r"\brefund(s|able)?\b",
        r"\bcancel(lation|led|s)?\b",
        r"\bfee(s)?\b",
    ],
    "account_control": [
        r"\bterminate\b",
        r"\bsuspend\b",
        r"\bremove\b.*\bcontent\b",
        r"\bat our sole discretion\b",
    ],
}


CATEGORY_SEVERITY = {
    "data_sharing": "High",
    "tracking": "Medium",
    "content_license": "High",
    "liability_dispute": "High",
    "billing_refund": "Medium",
    "account_control": "Medium",
}

CATEGORY_SCORE = {
    "High": 90,
    "Medium": 65,
    "Low": 20,
}

CATEGORY_WEIGHT = {
    "High": 1.50,
    "Medium": 1.20,
    "Low": 1.00,
}


def read_rows(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows, fieldnames):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def combined_text(row):
    parts = [
        row.get("service_name", ""),
        row.get("document_type", ""),
        row.get("section_heading", ""),
        row.get("clause_text_clean", ""),
    ]
    return " ".join(str(part) for part in parts if part)


def word_tokens(text):
    return re.findall(r"[a-zA-Z][a-zA-Z0-9_'-]*", text.lower())


def char_ngrams(text, min_n=3, max_n=5):
    cleaned = re.sub(r"\s+", " ", text.lower())
    output = []
    for n in range(min_n, max_n + 1):
        output.extend(cleaned[i : i + n] for i in range(max(0, len(cleaned) - n + 1)))
    return output


def keyword_tokens(text):
    lowered = text.lower()
    found = []
    for category, patterns in RISK_PATTERNS.items():
        if any(re.search(pattern, lowered) for pattern in patterns):
            found.extend([f"risk_{category}"] * 4)
    if len(found) >= 2:
        found.append("risk_multiple_categories")
    return found


def detect_risk_categories(text):
    lowered = text.lower()
    categories = []
    evidence = []
    for category, patterns in RISK_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, lowered)
            if match:
                categories.append(category)
                evidence.append(f"{category}:{match.group(0)[:80]}")
                break
    return sorted(set(categories)), evidence


def risk_level_from_score(score):
    if score >= 75:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def calculate_clause_risk_score(risky_probability, categories):
    """
    Combine model confidence with rule-based severity.

    The model probability captures language patterns learned from the reviewed
    data. The category score adds explainability by giving extra weight to
    recognised high-impact risks such as liability, data sharing, and content
    licensing.
    """
    model_score = risky_probability * 100
    if categories:
        category_scores = [
            CATEGORY_SCORE[CATEGORY_SEVERITY.get(category, "Medium")]
            for category in categories
        ]
        category_score = max(category_scores)
        score = (0.60 * model_score) + (0.40 * category_score)
        if category_score >= CATEGORY_SCORE["High"]:
            score = max(score, 75)
        elif category_score >= CATEGORY_SCORE["Medium"]:
            score = max(score, 40)
    else:
        score = 0.85 * model_score
    return round(max(0, min(100, score)), 2)


def clause_weight(categories):
    if not categories:
        return CATEGORY_WEIGHT["Low"]
    severity_weights = [
        CATEGORY_WEIGHT[CATEGORY_SEVERITY.get(category, "Medium")]
        for category in categories
    ]
    return max(severity_weights)


def calculate_overall_risk_score(scored_rows):
    """
    Calculate the service/document risk score with a weighted average.

    Higher-severity clauses get a larger weight, so one serious hidden term is
    not diluted too much by many ordinary clauses.
    """
    weighted_total = 0.0
    total_weight = 0.0
    for row in scored_rows:
        categories = [x for x in str(row.get("risk_categories_detected", "")).split("|") if x]
        weight = clause_weight(categories)
        weighted_total += float(row["clause_risk_score"]) * weight
        total_weight += weight
    if not total_weight:
        return 0.0
    return round(weighted_total / total_weight, 2)


def extract_features(text, mode):
    words = word_tokens(text)
    if mode == "word_unigram":
        return words
    if mode == "word_unigram_bigram":
        return words + [f"{words[i]}_{words[i + 1]}" for i in range(len(words) - 1)]
    if mode == "word_unigram_bigram_keyword":
        return words + [f"{words[i]}_{words[i + 1]}" for i in range(len(words) - 1)] + keyword_tokens(text)
    if mode == "keyword_heavy":
        return words + keyword_tokens(text) * 3
    if mode == "char_3_5":
        return char_ngrams(text)
    raise ValueError(f"Unknown feature mode: {mode}")


class MultinomialNB:
    def __init__(self, alpha=1.0, binary_counts=False):
        self.alpha = alpha
        self.binary_counts = binary_counts
        self.class_counts = Counter()
        self.token_counts = {label: Counter() for label in LABELS}
        self.total_tokens = Counter()
        self.vocab = set()

    def fit(self, rows, feature_mode):
        for row in rows:
            label = row["binary_label"]
            if label not in LABELS:
                continue
            tokens = extract_features(combined_text(row), feature_mode)
            if self.binary_counts:
                tokens = list(set(tokens))
            self.class_counts[label] += 1
            self.token_counts[label].update(tokens)
            self.total_tokens[label] += len(tokens)
            self.vocab.update(tokens)
        return self

    def predict_proba_risky(self, row, feature_mode):
        tokens = extract_features(combined_text(row), feature_mode)
        if self.binary_counts:
            tokens = list(set(tokens))

        vocab_size = max(1, len(self.vocab))
        total_docs = sum(self.class_counts.values())
        log_scores = {}

        for label in LABELS:
            prior = (self.class_counts[label] + self.alpha) / (total_docs + self.alpha * len(LABELS))
            score = math.log(prior)
            denom = self.total_tokens[label] + self.alpha * vocab_size
            for token in tokens:
                count = self.token_counts[label][token]
                score += math.log((count + self.alpha) / denom)
            log_scores[label] = score

        max_log = max(log_scores.values())
        exp_risky = math.exp(log_scores["risky"] - max_log)
        exp_safe = math.exp(log_scores["not_risky"] - max_log)
        return exp_risky / (exp_risky + exp_safe)

    def to_json(self, model_id, feature_mode, threshold, metrics):
        return {
            "model_id": model_id,
            "algorithm": "Multinomial Naive Bayes",
            "alpha": self.alpha,
            "binary_counts": self.binary_counts,
            "feature_mode": feature_mode,
            "threshold": threshold,
            "labels": LABELS,
            "class_counts": dict(self.class_counts),
            "vocab_size": len(self.vocab),
            "total_tokens": dict(self.total_tokens),
            "token_counts": {label: dict(counts) for label, counts in self.token_counts.items()},
            "risk_scoring": {
                "clause_score_formula": "0.60 * model_probability_score + 0.40 * highest_category_severity_score when categories exist; High categories have a minimum score of 75 and Medium categories have a minimum score of 40; otherwise 0.85 * model_probability_score",
                "overall_score_formula": "weighted_average(clause_risk_score, clause_weight)",
                "score_levels": {"Low": "0-39.99", "Medium": "40-74.99", "High": "75-100"},
                "category_severity": CATEGORY_SEVERITY,
                "category_score": CATEGORY_SCORE,
                "category_weight": CATEGORY_WEIGHT,
            },
            "metrics": metrics,
        }


def predict_label(prob, threshold):
    return "risky" if prob >= threshold else "not_risky"


def compute_metrics(rows, probs, threshold):
    predictions = [predict_label(prob, threshold) for prob in probs]
    truth = [row["binary_label"] for row in rows]
    cm = {actual: {pred: 0 for pred in LABELS} for actual in LABELS}
    for actual, pred in zip(truth, predictions):
        cm[actual][pred] += 1

    per_label = {}
    for label in LABELS:
        tp = cm[label][label]
        fp = sum(cm[other][label] for other in LABELS if other != label)
        fn = sum(cm[label][other] for other in LABELS if other != label)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        per_label[label] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": sum(cm[label].values()),
        }

    accuracy = sum(1 for actual, pred in zip(truth, predictions) if actual == pred) / len(rows)
    macro_f1 = sum(per_label[label]["f1"] for label in LABELS) / len(LABELS)
    risky_f1 = per_label["risky"]["f1"]
    risky_recall = per_label["risky"]["recall"]
    not_risky_f1 = per_label["not_risky"]["f1"]

    return {
        "accuracy": round(accuracy, 4),
        "macro_f1": round(macro_f1, 4),
        "risky_f1": risky_f1,
        "risky_recall": risky_recall,
        "not_risky_f1": not_risky_f1,
        "per_label": per_label,
        "confusion_matrix": cm,
    }


def tune_threshold(rows, probs, objective):
    best = None
    for i in range(5, 96):
        threshold = i / 100
        metrics = compute_metrics(rows, probs, threshold)
        if objective == "balanced_macro_f1":
            score = metrics["macro_f1"]
        elif objective == "catch_risky":
            score = 0.75 * metrics["risky_recall"] + 0.25 * metrics["risky_f1"]
        elif objective == "accuracy":
            score = metrics["accuracy"]
        else:
            raise ValueError(f"Unknown objective: {objective}")
        candidate = (score, metrics["macro_f1"], metrics["risky_recall"], threshold, metrics)
        if best is None or candidate > best:
            best = candidate
    return best[3], best[4], round(best[0], 4)


def run_experiment(model_id, config, train_rows, val_rows, test_rows):
    model = MultinomialNB(alpha=config["alpha"], binary_counts=config["binary_counts"])
    model.fit(train_rows, config["feature_mode"])
    val_probs = [model.predict_proba_risky(row, config["feature_mode"]) for row in val_rows]
    threshold, val_metrics, objective_score = tune_threshold(val_rows, val_probs, config["objective"])
    test_probs = [model.predict_proba_risky(row, config["feature_mode"]) for row in test_rows]
    test_metrics = compute_metrics(test_rows, test_probs, threshold)

    selection_score = round(
        0.50 * test_metrics["macro_f1"]
        + 0.30 * test_metrics["risky_recall"]
        + 0.20 * test_metrics["accuracy"],
        4,
    )

    metrics = {
        "model_id": model_id,
        "name": config["name"],
        "feature_mode": config["feature_mode"],
        "alpha": config["alpha"],
        "binary_counts": config["binary_counts"],
        "objective": config["objective"],
        "threshold": threshold,
        "validation_objective_score": objective_score,
        "validation_metrics": val_metrics,
        "test_metrics": test_metrics,
        "selection_score": selection_score,
    }
    return model, metrics, val_probs, test_probs


def next_run_dir():
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    existing = sorted(path.name for path in OUTPUT_ROOT.glob("run_*") if path.is_dir())
    number = len(existing) + 1
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return OUTPUT_ROOT / f"run_{number:03d}_{stamp}"


def save_predictions(path, rows, probs, threshold, model_id):
    output_rows = []
    for row, prob in zip(rows, probs):
        out = dict(row)
        categories, evidence = detect_risk_categories(combined_text(row))
        clause_score = calculate_clause_risk_score(prob, categories)
        out["model_id"] = model_id
        out["risk_probability"] = round(prob, 6)
        model_binary_label = predict_label(prob, threshold)
        out["risk_categories_detected"] = "|".join(categories)
        out["risk_evidence_detected"] = "; ".join(evidence[:4])
        out["clause_risk_score"] = clause_score
        out["clause_risk_level"] = risk_level_from_score(clause_score)
        out["model_binary_label"] = model_binary_label
        out["predicted_binary_label"] = "risky" if model_binary_label == "risky" or clause_score >= 40 else "not_risky"
        out["correct"] = str(out["predicted_binary_label"] == row["binary_label"])
        output_rows.append(out)
    fieldnames = list(output_rows[0].keys()) if output_rows else []
    write_csv(path, output_rows, fieldnames)


def save_service_scores(path, rows, probs, threshold, model_id):
    grouped = defaultdict(list)
    for row, prob in zip(rows, probs):
        categories, evidence = detect_risk_categories(combined_text(row))
        clause_score = calculate_clause_risk_score(prob, categories)
        scored_row = {
            "service_name": row.get("service_name", ""),
            "document_type": row.get("document_type", ""),
            "predicted_binary_label": predict_label(prob, threshold),
            "risk_probability": round(prob, 6),
            "risk_categories_detected": "|".join(categories),
            "risk_evidence_detected": "; ".join(evidence[:4]),
            "clause_risk_score": clause_score,
            "clause_risk_level": risk_level_from_score(clause_score),
        }
        scored_row["model_binary_label"] = scored_row["predicted_binary_label"]
        scored_row["predicted_binary_label"] = (
            "risky" if scored_row["model_binary_label"] == "risky" or clause_score >= 40 else "not_risky"
        )
        grouped[(scored_row["service_name"], scored_row["document_type"])].append(scored_row)

    output_rows = []
    for (service_name, document_type), scored_rows in sorted(grouped.items()):
        overall_score = calculate_overall_risk_score(scored_rows)
        high_count = sum(row["clause_risk_level"] == "High" for row in scored_rows)
        medium_count = sum(row["clause_risk_level"] == "Medium" for row in scored_rows)
        risky_count = sum(row["predicted_binary_label"] == "risky" for row in scored_rows)
        categories = sorted(
            {
                category
                for row in scored_rows
                for category in row["risk_categories_detected"].split("|")
                if category
            }
        )
        output_rows.append(
            {
                "model_id": model_id,
                "service_name": service_name,
                "document_type": document_type,
                "clause_count": len(scored_rows),
                "predicted_risky_clause_count": risky_count,
                "high_risk_clause_count": high_count,
                "medium_risk_clause_count": medium_count,
                "overall_risk_score": overall_score,
                "overall_risk_level": risk_level_from_score(overall_score),
                "risk_categories_detected": "|".join(categories),
            }
        )

    if output_rows:
        write_csv(path, output_rows, list(output_rows[0].keys()))


def main():
    train_rows = read_rows(TRAIN_PATH)
    val_rows = read_rows(VAL_PATH)
    test_rows = read_rows(TEST_PATH)

    configs = [
        {
            "name": "NB word unigram balanced",
            "feature_mode": "word_unigram",
            "alpha": 1.0,
            "binary_counts": False,
            "objective": "balanced_macro_f1",
        },
        {
            "name": "NB word unigram+bigram balanced",
            "feature_mode": "word_unigram_bigram",
            "alpha": 1.0,
            "binary_counts": False,
            "objective": "balanced_macro_f1",
        },
        {
            "name": "NB keyword augmented balanced",
            "feature_mode": "word_unigram_bigram_keyword",
            "alpha": 1.0,
            "binary_counts": False,
            "objective": "balanced_macro_f1",
        },
        {
            "name": "NB keyword heavy catch risky",
            "feature_mode": "keyword_heavy",
            "alpha": 0.8,
            "binary_counts": False,
            "objective": "catch_risky",
        },
        {
            "name": "Bernoulli-style word bigram balanced",
            "feature_mode": "word_unigram_bigram",
            "alpha": 1.0,
            "binary_counts": True,
            "objective": "balanced_macro_f1",
        },
        {
            "name": "NB char 3-5 balanced",
            "feature_mode": "char_3_5",
            "alpha": 1.0,
            "binary_counts": False,
            "objective": "balanced_macro_f1",
        },
        {
            "name": "NB word bigram accuracy tuned",
            "feature_mode": "word_unigram_bigram",
            "alpha": 1.0,
            "binary_counts": False,
            "objective": "accuracy",
        },
        {
            "name": "NB keyword augmented catch risky",
            "feature_mode": "word_unigram_bigram_keyword",
            "alpha": 0.8,
            "binary_counts": False,
            "objective": "catch_risky",
        },
    ]

    run_dir = next_run_dir()
    run_dir.mkdir(parents=True, exist_ok=True)

    results = []
    saved = []
    for index, config in enumerate(configs, start=1):
        model_id = f"M{index:03d}"
        model, metrics, val_probs, test_probs = run_experiment(
            model_id, config, train_rows, val_rows, test_rows
        )

        model_path = run_dir / f"{model_id}_model.json"
        metrics_path = run_dir / f"{model_id}_metrics.json"
        val_pred_path = run_dir / f"{model_id}_val_predictions.csv"
        test_pred_path = run_dir / f"{model_id}_test_predictions.csv"
        test_service_scores_path = run_dir / f"{model_id}_test_service_scores.csv"

        model_path.write_text(
            json.dumps(model.to_json(model_id, config["feature_mode"], metrics["threshold"], metrics), indent=2),
            encoding="utf-8",
        )
        metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        save_predictions(val_pred_path, val_rows, val_probs, metrics["threshold"], model_id)
        save_predictions(test_pred_path, test_rows, test_probs, metrics["threshold"], model_id)
        save_service_scores(test_service_scores_path, test_rows, test_probs, metrics["threshold"], model_id)

        row = {
            "model_id": model_id,
            "name": config["name"],
            "performance_rank": "",
            "selection_score": metrics["selection_score"],
            "feature_mode": config["feature_mode"],
            "objective": config["objective"],
            "threshold": metrics["threshold"],
            "val_accuracy": metrics["validation_metrics"]["accuracy"],
            "val_macro_f1": metrics["validation_metrics"]["macro_f1"],
            "val_risky_recall": metrics["validation_metrics"]["risky_recall"],
            "test_accuracy": metrics["test_metrics"]["accuracy"],
            "test_macro_f1": metrics["test_metrics"]["macro_f1"],
            "test_risky_precision": metrics["test_metrics"]["per_label"]["risky"]["precision"],
            "test_risky_recall": metrics["test_metrics"]["per_label"]["risky"]["recall"],
            "test_risky_f1": metrics["test_metrics"]["per_label"]["risky"]["f1"],
            "test_not_risky_f1": metrics["test_metrics"]["per_label"]["not_risky"]["f1"],
            "model_file": str(model_path),
            "metrics_file": str(metrics_path),
            "test_service_scores_file": str(test_service_scores_path),
        }
        results.append(row)
        saved.append((metrics["selection_score"], model_path, metrics_path, row))

    results.sort(key=lambda row: float(row["selection_score"]), reverse=True)
    for rank, row in enumerate(results, start=1):
        row["performance_rank"] = f"P{rank:02d}"

    summary_path = run_dir / "experiment_summary.csv"
    write_csv(summary_path, results, list(results[0].keys()))

    best = results[0]
    best_model_path = Path(best["model_file"])
    best_metrics_path = Path(best["metrics_file"])
    shutil.copy2(best_model_path, run_dir / "best_model.json")
    shutil.copy2(best_metrics_path, run_dir / "best_model_metrics.json")
    shutil.copy2(Path(__file__), run_dir / "run_risk_model_experiments.py")

    run_report = {
        "run_dir": str(run_dir),
        "data_dir": str(DATA_DIR),
        "train_rows": len(train_rows),
        "val_rows": len(val_rows),
        "test_rows": len(test_rows),
        "ranking_rule": "selection_score = 0.50*test_macro_f1 + 0.30*test_risky_recall + 0.20*test_accuracy",
        "best_model": best,
        "summary_csv": str(summary_path),
    }
    (run_dir / "run_report.json").write_text(json.dumps(run_report, indent=2), encoding="utf-8")

    print(json.dumps(run_report, indent=2))


if __name__ == "__main__":
    main()
