import argparse
import csv
import html
import json
import random
import re
from pathlib import Path

import numpy as np
from datasets import Dataset, DatasetDict
from sklearn.metrics import f1_score, precision_score, recall_score
from transformers import AutoModelForSequenceClassification, AutoTokenizer, DataCollatorWithPadding, Trainer, TrainingArguments

from labels import PRIVACY_LABELS


CATEGORY_MAP = {
    "First Party Collection/Use": "Data collection and use",
    "Third Party Sharing/Collection": "Third-party sharing and collection",
    "User Choice/Control": "User choice and control",
    "User Access, Edit and Deletion": "Data access and deletion",
    "Data Retention": "Data retention",
    "Data Security": "Data security",
    "Policy Change": "Policy changes",
    "Do Not Track": "Do Not Track",
    "International and Specific Audiences": "Specific audiences",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune a privacy-practice classifier on OPP-115.")
    parser.add_argument("--corpus", default="../OPP-115_v1_0/OPP-115")
    parser.add_argument("--model", default="nlpaueb/legal-bert-small-uncased")
    parser.add_argument("--output", default="privacy-model")
    parser.add_argument("--epochs", type=float, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def plain_text(value):
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def policy_id(path):
    return path.stem.split("_", 1)[0]


def load_examples(corpus):
    annotation_dir = corpus / "consolidation" / "threshold-0.75-overlap-similarity"
    policy_dir = corpus / "sanitized_policies"
    labels_by_segment = {}
    for path in annotation_dir.glob("*.csv"):
        current_policy = policy_id(path)
        with path.open(encoding="utf-8", newline="") as stream:
            for row in csv.reader(stream):
                if len(row) < 6 or row[5] not in CATEGORY_MAP:
                    continue
                key = (current_policy, int(row[4]))
                labels_by_segment.setdefault(key, set()).add(CATEGORY_MAP[row[5]])

    examples = []
    for path in policy_dir.glob("*.html"):
        current_policy = policy_id(path)
        segments = path.read_text(encoding="utf-8", errors="replace").split("|||")
        for index, segment in enumerate(segments):
            text = plain_text(segment)
            if len(text) < 20:
                continue
            active = labels_by_segment.get((current_policy, index), set())
            examples.append({
                "policy_id": current_policy,
                "text": text,
                "labels": [1.0 if label in active else 0.0 for label in PRIVACY_LABELS],
            })
    return examples


def split_by_policy(examples, seed):
    policies = sorted({example["policy_id"] for example in examples})
    random.Random(seed).shuffle(policies)
    train_end = int(len(policies) * 0.8)
    validation_end = int(len(policies) * 0.9)
    groups = {
        "train": set(policies[:train_end]),
        "validation": set(policies[train_end:validation_end]),
        "test": set(policies[validation_end:]),
    }
    return DatasetDict({
        name: Dataset.from_list([
            {"text": item["text"], "labels": item["labels"]}
            for item in examples if item["policy_id"] in selected
        ])
        for name, selected in groups.items()
    })


def optimal_thresholds(logits, expected):
    probabilities = 1 / (1 + np.exp(-logits))
    thresholds = []
    for index in range(len(PRIVACY_LABELS)):
        best_threshold, best_f1 = 0.5, -1.0
        for candidate in np.arange(0.2, 0.91, 0.05):
            score = f1_score(expected[:, index], probabilities[:, index] >= candidate, zero_division=0)
            if score > best_f1:
                best_threshold, best_f1 = float(candidate), score
        thresholds.append(round(best_threshold, 2))
    return thresholds


def main():
    args = parse_args()
    corpus = Path(args.corpus).resolve()
    if not corpus.is_dir():
        raise SystemExit(f"OPP-115 corpus not found at {corpus}")
    examples = load_examples(corpus)
    dataset = split_by_policy(examples, args.seed)
    print({split: len(rows) for split, rows in dataset.items()})

    tokenizer = AutoTokenizer.from_pretrained(args.model)
    tokenized = dataset.map(
        lambda batch: {**tokenizer(batch["text"], truncation=True, max_length=256), "labels": batch["labels"]},
        batched=True,
        remove_columns=["text"],
    )
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=len(PRIVACY_LABELS),
        problem_type="multi_label_classification",
        id2label={index: label for index, label in enumerate(PRIVACY_LABELS)},
        label2id={label: index for index, label in enumerate(PRIVACY_LABELS)},
    )

    def metrics(prediction):
        probabilities = 1 / (1 + np.exp(-prediction.predictions))
        predicted = probabilities >= 0.5
        expected = prediction.label_ids.astype(int)
        return {
            "micro_f1": f1_score(expected, predicted, average="micro", zero_division=0),
            "macro_f1": f1_score(expected, predicted, average="macro", zero_division=0),
            "micro_precision": precision_score(expected, predicted, average="micro", zero_division=0),
            "micro_recall": recall_score(expected, predicted, average="micro", zero_division=0),
        }

    output = Path(args.output)
    trainer = Trainer(
        model=model,
        args=TrainingArguments(
            output_dir=str(output / "checkpoints"),
            learning_rate=args.learning_rate,
            per_device_train_batch_size=args.batch_size,
            per_device_eval_batch_size=args.batch_size * 2,
            num_train_epochs=args.epochs,
            weight_decay=0.01,
            eval_strategy="epoch",
            save_strategy="epoch",
            load_best_model_at_end=True,
            metric_for_best_model="macro_f1",
            greater_is_better=True,
            save_total_limit=2,
            report_to="none",
            seed=args.seed,
        ),
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=metrics,
    )
    trainer.train()
    validation = trainer.predict(tokenized["validation"])
    thresholds = optimal_thresholds(validation.predictions, validation.label_ids.astype(int))
    test_metrics = trainer.evaluate(tokenized["test"], metric_key_prefix="test")
    trainer.save_model(str(output))
    tokenizer.save_pretrained(str(output))
    config = {
        "labels": PRIVACY_LABELS,
        "thresholds": dict(zip(PRIVACY_LABELS, thresholds)),
        "source": "OPP-115 v1.0 consolidated annotations (0.75 overlap similarity)",
        "testMetricsAtFixedThreshold": test_metrics,
    }
    (output / "analysis_config.json").write_text(json.dumps(config, indent=2), encoding="utf-8")
    print(json.dumps(config, indent=2))


if __name__ == "__main__":
    main()
