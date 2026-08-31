import argparse
import json
from pathlib import Path

import numpy as np
from datasets import load_dataset
from sklearn.metrics import f1_score, precision_score, recall_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

from labels import LABELS


def parse_args():
    parser = argparse.ArgumentParser(description="Fine-tune LegalBERT on LexGLUE UNFAIR-ToS.")
    parser.add_argument("--model", default="nlpaueb/legal-bert-small-uncased")
    parser.add_argument("--output", default="model")
    parser.add_argument("--epochs", type=float, default=4)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--threshold", type=float, default=0.7)
    return parser.parse_args()


def multi_hot(label_ids):
    values = np.zeros(len(LABELS), dtype=np.float32)
    for label_id in label_ids:
        values[int(label_id)] = 1.0
    return values.tolist()


def main():
    args = parse_args()
    output = Path(args.output)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    dataset = load_dataset("coastalcph/lex_glue", "unfair_tos")

    def tokenize(batch):
        encoded = tokenizer(batch["text"], truncation=True, max_length=256)
        encoded["labels"] = [multi_hot(labels) for labels in batch["labels"]]
        return encoded

    tokenized = dataset.map(tokenize, batched=True, remove_columns=dataset["train"].column_names)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model,
        num_labels=len(LABELS),
        problem_type="multi_label_classification",
        id2label={index: label for index, label in enumerate(LABELS)},
        label2id={label: index for index, label in enumerate(LABELS)},
    )

    def metrics(prediction):
        probabilities = 1 / (1 + np.exp(-prediction.predictions))
        predicted = (probabilities >= args.threshold).astype(int)
        expected = prediction.label_ids.astype(int)
        return {
            "micro_f1": f1_score(expected, predicted, average="micro", zero_division=0),
            "macro_f1": f1_score(expected, predicted, average="macro", zero_division=0),
            "micro_precision": precision_score(expected, predicted, average="micro", zero_division=0),
            "micro_recall": recall_score(expected, predicted, average="micro", zero_division=0),
        }

    training_args = TrainingArguments(
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
        seed=42,
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized["train"],
        eval_dataset=tokenized["validation"],
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=metrics,
    )
    trainer.train()
    test_metrics = trainer.evaluate(tokenized["test"], metric_key_prefix="test")
    trainer.save_model(str(output))
    tokenizer.save_pretrained(str(output))
    (output / "analysis_config.json").write_text(
        json.dumps({"labels": LABELS, "threshold": args.threshold, "testMetrics": test_metrics}, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(test_metrics, indent=2))


if __name__ == "__main__":
    main()
