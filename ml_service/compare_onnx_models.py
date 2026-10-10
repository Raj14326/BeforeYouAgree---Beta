"""Evaluate the Base and BYA Small ONNX classifiers on one test split."""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from datasets import load_dataset
from transformers import AutoTokenizer


MODELS = {
    "base": Path("ml/local-models/bya-legalbert-multilabel-v1-onnx"),
    "small": Path("ml/local-models/bya-legalbert-small-unfair-tos"),
}


def multi_hot(label_rows, width=8):
    result = np.zeros((len(label_rows), width), dtype=np.int8)
    for row, labels in enumerate(label_rows):
        result[row, labels] = 1
    return result


def safe_ratio(numerator, denominator):
    return float(numerator / denominator) if denominator else 0.0


def f1(tp, fp, fn):
    precision = safe_ratio(tp, tp + fp)
    recall = safe_ratio(tp, tp + fn)
    return safe_ratio(2 * precision * recall, precision + recall)


def metrics(expected, predicted):
    per_label = []
    for column in range(expected.shape[1]):
        truth, guess = expected[:, column], predicted[:, column]
        tp = int(np.sum((truth == 1) & (guess == 1)))
        fp = int(np.sum((truth == 0) & (guess == 1)))
        fn = int(np.sum((truth == 1) & (guess == 0)))
        per_label.append(f1(tp, fp, fn))
    tp = int(np.sum((expected == 1) & (predicted == 1)))
    fp = int(np.sum((expected == 0) & (predicted == 1)))
    fn = int(np.sum((expected == 1) & (predicted == 0)))
    expected_risk = expected.any(axis=1)
    predicted_risk = predicted.any(axis=1)
    binary_tp = int(np.sum(expected_risk & predicted_risk))
    binary_fp = int(np.sum(~expected_risk & predicted_risk))
    binary_fn = int(np.sum(expected_risk & ~predicted_risk))
    return {
        "macro_f1": float(np.mean(per_label)),
        "micro_f1": f1(tp, fp, fn),
        "exact_match_accuracy": float(np.mean(np.all(expected == predicted, axis=1))),
        "binary_risk_f1": f1(binary_tp, binary_fp, binary_fn),
        "binary_risk_accuracy": float(np.mean(expected_risk == predicted_risk)),
    }


def predict(model_dir: Path, texts: list[str], batch_size=32):
    config = json.loads((model_dir / "risk_config.json").read_text(encoding="utf-8"))
    thresholds = np.array([config["thresholds"][item["id"]] for item in config["labels"]])
    tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
    session = ort.InferenceSession(str(model_dir / "onnx" / "model.onnx"), providers=["CPUExecutionProvider"])
    scores = []
    started = time.perf_counter()
    for start in range(0, len(texts), batch_size):
        encoded = tokenizer(
            texts[start : start + batch_size], padding=True, truncation=True,
            max_length=128, return_tensors="np"
        )
        encoded.setdefault("token_type_ids", np.zeros_like(encoded["input_ids"]))
        inputs = {item.name: encoded[item.name].astype(np.int64) for item in session.get_inputs()}
        scores.append(1 / (1 + np.exp(-session.run(None, inputs)[0])))
    elapsed = time.perf_counter() - started
    probabilities = np.concatenate(scores)
    return probabilities >= thresholds, elapsed


def main():
    dataset = load_dataset("coastalcph/lex_glue", "unfair_tos", split="test")
    texts = list(dataset["text"])
    expected = multi_hot(dataset["labels"])
    predictions = {}
    report = {"dataset": "coastalcph/lex_glue:unfair_tos:test", "examples": len(texts), "models": {}}
    for name, path in MODELS.items():
        prediction, elapsed = predict(path, texts)
        predictions[name] = prediction
        report["models"][name] = {
            "model_id": json.loads((path / "risk_config.json").read_text(encoding="utf-8"))["model_id"],
            **metrics(expected, prediction),
            "seconds": elapsed,
            "examples_per_second": len(texts) / elapsed,
        }
    same = np.all(predictions["base"] == predictions["small"], axis=1)
    report["agreement"] = {
        "exact_same_predictions": int(np.sum(same)),
        "different_predictions": int(np.sum(~same)),
        "exact_agreement_rate": float(np.mean(same)),
        "per_label_agreement": np.mean(predictions["base"] == predictions["small"], axis=0).tolist(),
    }
    output = Path("ml/comparison-models/base-vs-bya-small.json")
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
