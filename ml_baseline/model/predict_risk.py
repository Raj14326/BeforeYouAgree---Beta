import argparse
import json
import math
import re
from pathlib import Path


LABELS = ["not_risky", "risky"]

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
    raise ValueError(f"Unsupported feature mode: {mode}")


def detect_risk_categories(text):
    lowered = text.lower()
    categories = []
    evidence = []
    for category, patterns in RISK_PATTERNS.items():
        for pattern in patterns:
            match = re.search(pattern, lowered)
            if match:
                categories.append(category)
                evidence.append({"category": category, "evidence": match.group(0)[:120]})
                break
    return sorted(set(categories)), evidence


def risk_level_from_score(score):
    if score >= 75:
        return "High"
    if score >= 40:
        return "Medium"
    return "Low"


def calculate_clause_risk_score(risky_probability, categories):
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


def load_model(model_path):
    with Path(model_path).open("r", encoding="utf-8") as f:
        return json.load(f)


def risky_probability(model, text):
    feature_mode = model["feature_mode"]
    alpha = float(model.get("alpha", 1.0))
    tokens = extract_features(text, feature_mode)
    if model.get("binary_counts"):
        tokens = list(set(tokens))

    token_counts = model["token_counts"]
    total_tokens = model["total_tokens"]
    class_counts = model["class_counts"]
    vocab_size = max(1, int(model["vocab_size"]))
    total_docs = sum(int(class_counts[label]) for label in LABELS)

    log_scores = {}
    for label in LABELS:
        prior = (int(class_counts[label]) + alpha) / (total_docs + alpha * len(LABELS))
        score = math.log(prior)
        denom = float(total_tokens[label]) + alpha * vocab_size
        counts = token_counts[label]
        for token in tokens:
            score += math.log((int(counts.get(token, 0)) + alpha) / denom)
        log_scores[label] = score

    max_log = max(log_scores.values())
    exp_risky = math.exp(log_scores["risky"] - max_log)
    exp_not_risky = math.exp(log_scores["not_risky"] - max_log)
    return exp_risky / (exp_risky + exp_not_risky)


def predict_clause(model, clause_text, section_heading="", service_name="", document_type=""):
    text = " ".join(
        part for part in [service_name, document_type, section_heading, clause_text] if part
    )
    probability = risky_probability(model, text)
    threshold = float(model.get("threshold", 0.5))
    model_binary_label = "risky" if probability >= threshold else "not_risky"
    categories, evidence = detect_risk_categories(text)
    risk_score = calculate_clause_risk_score(probability, categories)
    binary_label = "risky" if model_binary_label == "risky" or risk_score >= 40 else "not_risky"

    return {
        "binary_label": binary_label,
        "model_binary_label": model_binary_label,
        "risk_probability": round(probability, 6),
        "risk_score": risk_score,
        "risk_level": risk_level_from_score(risk_score),
        "risk_categories": categories,
        "risk_evidence": evidence,
        "model_id": model.get("model_id", "M006"),
        "threshold": threshold,
    }


def main():
    parser = argparse.ArgumentParser(description="Predict clause risk using the M006 baseline model.")
    parser.add_argument("--model", default="M006_model.json", help="Path to M006_model.json")
    parser.add_argument("--text", required=True, help="Clause text to analyse")
    parser.add_argument("--section", default="", help="Optional section heading")
    parser.add_argument("--service", default="", help="Optional service name")
    parser.add_argument("--document-type", default="", help="Optional document type")
    args = parser.parse_args()

    model = load_model(args.model)
    result = predict_clause(
        model=model,
        clause_text=args.text,
        section_heading=args.section,
        service_name=args.service,
        document_type=args.document_type,
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
