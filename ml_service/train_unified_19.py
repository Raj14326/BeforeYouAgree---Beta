"""Train and evaluate the BYA 19-label LegalBERT classifier."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from datasets import load_dataset
from sklearn.metrics import f1_score, precision_recall_fscore_support
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
    set_seed,
)


class WeightedTrainer(Trainer):
    def __init__(self, *args, positive_weights: torch.Tensor, **kwargs):
        super().__init__(*args, **kwargs)
        self.positive_weights = positive_weights

    def compute_loss(self, model, inputs, return_outputs=False, num_items_in_batch=None):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        loss = F.binary_cross_entropy_with_logits(
            outputs.logits,
            labels.float(),
            pos_weight=self.positive_weights.to(outputs.logits.device),
        )
        return (loss, outputs) if return_outputs else loss


def sigmoid(values):
    return 1 / (1 + np.exp(-values))


def thresholds_from_validation(logits, expected, labels):
    probabilities = sigmoid(logits)
    thresholds = {}
    for index, label in enumerate(labels):
        best_f1, best_threshold = -1.0, 0.5
        for threshold in np.arange(0.10, 0.951, 0.025):
            score = f1_score(expected[:, index], probabilities[:, index] >= threshold, zero_division=0)
            if score > best_f1:
                best_f1, best_threshold = score, float(threshold)
        thresholds[label] = round(best_threshold, 3)
    return thresholds


def evaluate(logits, expected, labels, thresholds):
    probabilities = sigmoid(logits)
    predicted = np.column_stack(
        [probabilities[:, index] >= thresholds[label] for index, label in enumerate(labels)]
    ).astype(int)
    expected = expected.astype(int)
    precision, recall, f1, support = precision_recall_fscore_support(
        expected, predicted, average=None, zero_division=0
    )
    return {
        "micro_f1": float(f1_score(expected, predicted, average="micro", zero_division=0)),
        "macro_f1": float(f1_score(expected, predicted, average="macro", zero_division=0)),
        "exact_match_accuracy": float(np.all(expected == predicted, axis=1).mean()),
        "per_label": {
            label: {
                "precision": round(float(precision[index]), 6),
                "recall": round(float(recall[index]), 6),
                "f1": round(float(f1[index]), 6),
                "positives": int(support[index]),
                "threshold": thresholds[label],
            }
            for index, label in enumerate(labels)
        },
    }


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=Path("ml/data/bya-19-v1"))
    parser.add_argument("--model", default="nlpaueb/legal-bert-small-uncased")
    parser.add_argument("--output", type=Path, default=Path("ml/local-models/bya-legalbert-19-v1"))
    parser.add_argument("--epochs", type=float, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--max-length", type=int, default=256)
    parser.add_argument("--seed", type=int, default=5120)
    parser.add_argument("--resume", default=None)
    return parser.parse_args()


def main():
    args = parse_args()
    set_seed(args.seed)
    manifest = json.loads((args.dataset / "dataset_manifest.json").read_text(encoding="utf-8"))
    labels = manifest["labels"]
    files = {
        split: str((args.dataset / f"{split}.jsonl").resolve())
        for split in ("train", "validation", "test")
    }
    dataset = load_dataset("json", data_files=files)
    tokenizer = AutoTokenizer.from_pretrained(args.model)

    def tokenize(batch):
        encoded = tokenizer(batch["text"], truncation=True, max_length=args.max_length)
        encoded["labels"] = [[float(value) for value in vector] for vector in batch["label_vector"]]
        return encoded

    tokenized = dataset.map(
        tokenize,
        batched=True,
        remove_columns=dataset["train"].column_names,
        desc="Tokenizing clauses",
    )
    train_expected = np.asarray(dataset["train"]["label_vector"], dtype=np.float32)
    positives = train_expected.sum(axis=0)
    raw_weights = np.sqrt((len(train_expected) - positives) / np.maximum(positives, 1))
    positive_weights = torch.tensor(np.clip(raw_weights, 1.0, 10.0), dtype=torch.float32)

    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=len(labels),
        problem_type="multi_label_classification",
        id2label={index: label for index, label in enumerate(labels)},
        label2id={label: index for index, label in enumerate(labels)},
    )

    def fixed_metrics(prediction):
        probabilities = sigmoid(prediction.predictions)
        predicted = probabilities >= 0.5
        expected = prediction.label_ids.astype(int)
        return {
            "micro_f1": f1_score(expected, predicted, average="micro", zero_division=0),
            "macro_f1": f1_score(expected, predicted, average="macro", zero_division=0),
        }

    checkpoints = args.output / "checkpoints"
    training_args = TrainingArguments(
        output_dir=str(checkpoints),
        learning_rate=args.learning_rate,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size * 2,
        num_train_epochs=args.epochs,
        weight_decay=0.01,
        warmup_ratio=0.08,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=args.seed,
        data_seed=args.seed,
        use_cpu=not torch.cuda.is_available(),
        dataloader_num_workers=0,
    )
    trainer = WeightedTrainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer, pad_to_multiple_of=8),
        compute_metrics=fixed_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
        positive_weights=positive_weights,
    )
    train_result = trainer.train(resume_from_checkpoint=args.resume)
    validation = trainer.predict(tokenized["validation"])
    thresholds = thresholds_from_validation(
        validation.predictions, validation.label_ids.astype(int), labels
    )
    test = trainer.predict(tokenized["test"])
    test_metrics = evaluate(test.predictions, test.label_ids, labels, thresholds)

    args.output.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(args.output))
    tokenizer.save_pretrained(str(args.output))
    risk_config = {
        "model_id": "BYA-LEGAL-BERT-19-V1",
        "base_model": args.model,
        "labels": [{"id": label, "name": label.replace("_", " ").title()} for label in labels],
        "thresholds": thresholds,
    }
    (args.output / "risk_config.json").write_text(
        json.dumps(risk_config, indent=2), encoding="utf-8"
    )
    report = {
        "base_model": args.model,
        "dataset": manifest["dataset_id"],
        "dataset_files": manifest["files"],
        "seed": args.seed,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "epochs_requested": args.epochs,
        "batch_size": args.batch_size,
        "max_length": args.max_length,
        "learning_rate": args.learning_rate,
        "positive_weights": {
            label: round(float(positive_weights[index]), 6) for index, label in enumerate(labels)
        },
        "train_metrics": train_result.metrics,
        "test": test_metrics,
        "warning": "Privacy test labels are weakly supervised until manually audited.",
    }
    (args.output / "training_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    print(json.dumps({"output": str(args.output), "test": test_metrics}, indent=2))


if __name__ == "__main__":
    main()
