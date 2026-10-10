"""Download raw LEGAL-BERT Small, export ONNX, and benchmark masked tokens.

The production Base comparison uses the separately fine-tuned SH4LAN ONNX
classifier; it must not be replaced with the raw nlpaueb Base checkpoint.
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from transformers import AutoModelForMaskedLM, AutoTokenizer


MODELS = {
    "small": "nlpaueb/legal-bert-small-uncased",
}


class LogitsOnly(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, input_ids, attention_mask, token_type_ids):
        return self.model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        ).logits


def export_model(name: str, repo: str, root: Path):
    target = root / name
    target.mkdir(parents=True, exist_ok=True)
    tokenizer = AutoTokenizer.from_pretrained(repo)
    model = AutoModelForMaskedLM.from_pretrained(repo).eval()
    tokenizer.save_pretrained(target)
    model.config.save_pretrained(target)

    encoded = tokenizer("The agreement is governed by applicable law.", return_tensors="pt")
    encoded.setdefault("token_type_ids", torch.zeros_like(encoded["input_ids"]))
    onnx_path = target / "model.onnx"
    torch.onnx.export(
        LogitsOnly(model),
        (encoded["input_ids"], encoded["attention_mask"], encoded["token_type_ids"]),
        onnx_path,
        input_names=["input_ids", "attention_mask", "token_type_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "sequence"},
            "attention_mask": {0: "batch", 1: "sequence"},
            "token_type_ids": {0: "batch", 1: "sequence"},
            "logits": {0: "batch", 1: "sequence"},
        },
        opset_version=17,
        dynamo=False,
    )
    return tokenizer, onnx_path


def legal_texts(csv_path: Path, limit: int, seed: int):
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    candidates = []
    for row in rows:
        text = next((row.get(key, "") for key in ("clause_text", "text", "clause", "content") if row.get(key)), "")
        if len(text.split()) >= 8:
            candidates.append(text)
    random.Random(seed).shuffle(candidates)
    return candidates[:limit]


def benchmark(tokenizer, onnx_path: Path, texts: list[str], batch_size: int, seed: int):
    rng = random.Random(seed)
    examples = []
    special = set(tokenizer.all_special_ids)
    for text in texts:
        encoded = tokenizer(text, truncation=True, max_length=128)
        candidates = [i for i, token in enumerate(encoded["input_ids"]) if token not in special]
        if not candidates:
            continue
        position = rng.choice(candidates)
        label = encoded["input_ids"][position]
        encoded["input_ids"][position] = tokenizer.mask_token_id
        examples.append((encoded, position, label))

    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    correct_1 = correct_5 = 0
    durations = []
    for start in range(0, len(examples), batch_size):
        batch = examples[start : start + batch_size]
        padded = tokenizer.pad([item[0] for item in batch], return_tensors="np")
        padded.setdefault("token_type_ids", np.zeros_like(padded["input_ids"]))
        inputs = {key: padded[key].astype(np.int64) for key in session.get_inputs() for key in [key.name]}
        before = time.perf_counter()
        logits = session.run(None, inputs)[0]
        durations.append(time.perf_counter() - before)
        for index, (_, position, label) in enumerate(batch):
            scores = logits[index, position]
            top_5 = np.argpartition(scores, -5)[-5:]
            correct_1 += int(int(np.argmax(scores)) == label)
            correct_5 += int(label in top_5)

    elapsed = sum(durations)
    return {
        "examples": len(examples),
        "top_1_accuracy": correct_1 / len(examples),
        "top_5_accuracy": correct_5 / len(examples),
        "onnx_seconds": elapsed,
        "examples_per_second": len(examples) / elapsed,
        "onnx_size_mb": onnx_path.stat().st_size / 1024 / 1024,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("ml/comparison-models"))
    parser.add_argument("--data", type=Path, default=Path("synthetic.csv"))
    parser.add_argument("--examples", type=int, default=500)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--seed", type=int, default=5120)
    args = parser.parse_args()

    texts = legal_texts(args.data, args.examples, args.seed)
    if not texts:
        raise ValueError(f"No usable legal clauses found in {args.data}")
    results = {}
    for name, repo in MODELS.items():
        tokenizer, onnx_path = export_model(name, repo, args.output)
        results[name] = {"source": repo, **benchmark(tokenizer, onnx_path, texts, args.batch_size, args.seed)}
        print(json.dumps({name: results[name]}, indent=2), flush=True)
    (args.output / "benchmark-results.json").write_text(json.dumps(results, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
