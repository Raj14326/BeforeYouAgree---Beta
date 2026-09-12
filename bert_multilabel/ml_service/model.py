"""Same overlapping-window/max-logit pooling during training and serving."""
import json
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer


class CapacityError(ValueError):
    pass


def encode(tokenizer, texts, max_length, stride, max_windows):
    encoded = tokenizer(texts, truncation=True, max_length=max_length, stride=stride,
                        return_overflowing_tokens=True, padding=True, return_tensors="pt")
    mapping = encoded.pop("overflow_to_sample_mapping")
    if len(mapping) > max_windows:
        raise CapacityError("Too many token windows; split the input. Nothing was silently truncated.")
    return encoded, mapping


def pooled_logits(model, encoded, mapping, count, device, window_batch=16):
    window_logits = []
    for start in range(0, len(mapping), window_batch):
        batch = {k: v[start:start + window_batch].to(device) for k, v in encoded.items()}
        logits = model(**batch).logits
        window_logits.append(logits)
    window_logits = torch.cat(window_logits)
    mapping = mapping.to(device)
    # Max pooling makes a clause risky if any window is risky. This is also
    # the training objective, not a new aggregation introduced only in serving.
    if window_logits.shape[1] == 2:
        differences = window_logits[:, 1] - window_logits[:, 0]
        pooled = torch.stack([differences[mapping == i].max() for i in range(count)])
        return torch.stack((torch.zeros_like(pooled), pooled), dim=1)
    return torch.stack([window_logits[mapping == i].max(dim=0).values for i in range(count)])


class RiskModel:
    def __init__(self, path, device="cpu", allow_experimental=False):
        path = Path(path)
        self.manifest = json.loads((path / "risk_config.json").read_text(encoding="utf-8"))
        m = self.manifest
        self.schema = m.get("schema_version")
        if self.schema not in (1, 2) or m.get("aggregation") not in ("max_logit", "max_logit_per_label"):
            raise ValueError("Unsupported or missing trained model manifest")
        if m.get("status") != "trained" or (m.get("experimental") and not allow_experimental):
            raise ValueError("Untrained or experimental model is not enabled for serving")
        if self.schema == 1 and m.get("label2id") != {"not_risky": 0, "risky": 1}:
            raise ValueError("Binary model label mapping does not match the API")
        if self.schema == 2:
            labels = m.get("labels", [])
            if len(labels) != 8 or set(m.get("thresholds", {})) != {x.get("id") for x in labels}:
                raise ValueError("Eight-label model manifest is incomplete")
            if any(not 0 < value < 1 for value in m["thresholds"].values()):
                raise ValueError("Invalid per-category thresholds")
        elif not 0 < m["threshold"] < 1:
            raise ValueError("Invalid binary threshold")
        if not 0 <= m["review_margin"] < 0.5:
            raise ValueError("Invalid decision configuration")
        self.device = torch.device(device)
        self.tokenizer = AutoTokenizer.from_pretrained(path, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(path, local_files_only=True,
                                                                       use_safetensors=True)
        expected_labels = 8 if self.schema == 2 else 2
        if self.model.config.label2id != m["label2id"] or self.model.config.num_labels != expected_labels:
            raise ValueError("Checkpoint labels do not match manifest")
        if not 8 <= m["max_length"] <= self.model.config.max_position_embeddings:
            raise ValueError("Invalid model input length")
        if not 0 <= m["stride"] < m["max_length"] - self.tokenizer.num_special_tokens_to_add():
            raise ValueError("Invalid window overlap")
        self.model.to(self.device).eval()

    @torch.inference_mode()
    def predict(self, clauses):
        m = self.manifest
        # Tokenize once to enforce a total per-request capacity, then stream
        # window batches through BERT. Never return partial document findings.
        encoded, mapping = encode(self.tokenizer, [c["text"] for c in clauses],
                                  m["max_length"], m["stride"], 2048)
        logits = pooled_logits(self.model, encoded, mapping, len(clauses), self.device)
        if self.schema == 1:
            scores = logits.softmax(-1)[:, 1].cpu().tolist()
        else:
            scores = torch.sigmoid(logits).cpu().tolist()
        flat_scores = scores if self.schema == 1 else [score for row in scores for score in row]
        if not all(0 <= score <= 1 for score in flat_scores):
            raise ValueError("Model produced non-finite scores")
        source = m.get("training_data") or {}
        model_source = m.get("base_model_source", m.get("base_model", ""))
        architecture = m.get("architecture", "LEGAL-BERT-Small")
        result = {"model": m["model_id"],
                "modelInfo": {
                    "architecture": architecture,
                    "baseModel": model_source,
                    "baseModelUrl": f"https://huggingface.co/{model_source}",
                    "modelRevision": m.get("revision", ""),
                    "trainingDataset": f"{source.get('dataset', '')} / {source.get('subset', '')}",
                    "datasetUrl": source.get("source_url", ""),
                    "datasetRevision": (m.get("dataset_revisions") or [""])[0],
                    "datasetLicense": source.get("license", ""),
                    "language": "English",
                    "scope": "Eight potentially unfair Terms of Service categories with independent decisions",
                    "scoreMeaning": m.get("score_note", "Uncalibrated model score")},
                "findings": []}
        if self.schema == 1:
            result["threshold"] = m["threshold"]
            result["findings"] = [
                {"clauseId": clause["clauseId"], "riskProbability": score,
                 "predictedLabel": "risky" if score >= m["threshold"] else "not_risky",
                 "needsReview": abs(score - m["threshold"]) <= m["review_margin"],
                 "windowCount": int((mapping == i).sum())}
                for i, (clause, score) in enumerate(zip(clauses, scores))]
        else:
            result["thresholds"] = m["thresholds"]
            for i, (clause, row_scores) in enumerate(zip(clauses, scores)):
                categories = []
                for definition, score in zip(m["labels"], row_scores):
                    threshold = m["thresholds"][definition["id"]]
                    categories.append({**definition, "score": score, "threshold": threshold,
                                       "predicted": score >= threshold})
                result["findings"].append({
                    "clauseId": clause["clauseId"], "riskProbability": max(row_scores),
                    "predictedLabel": "risky" if any(x["predicted"] for x in categories) else "not_risky",
                    "needsReview": any(abs(x["score"] - x["threshold"]) <= m["review_margin"] for x in categories),
                    "categories": categories, "windowCount": int((mapping == i).sum())})
        return result
