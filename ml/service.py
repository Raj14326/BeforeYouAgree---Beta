import json
import os
import re
from contextlib import asynccontextmanager
from pathlib import Path

import torch
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from contract_risk import filter_contract_risks
from labels import (
    CONCRETE_RISK_LABELS,
    LABEL_DESCRIPTIONS,
    LABELS,
    PRIVACY_LABELS,
)
from privacy_risk import detect_privacy_risks
from segmentation import sentence_segments

MODEL_ID = os.getenv(
    "LEGALBERT_MODEL",
    "Agreemind/lexglue-legalbert-small-unfair-tos",
)
PRIVACY_MODEL_ID = os.getenv("PRIVACY_MODEL", "")
if not PRIVACY_MODEL_ID and Path("privacy-model").is_dir():
    PRIVACY_MODEL_ID = "privacy-model"
DEFAULT_THRESHOLD = float(os.getenv("ANALYSIS_THRESHOLD", "0.7"))
MAX_DOCUMENT_CHARACTERS = int(os.getenv("MAX_DOCUMENT_CHARACTERS", "500000"))
BATCH_SIZE = int(os.getenv("ANALYSIS_BATCH_SIZE", "24"))
API_TOKEN = os.getenv("ANALYSIS_API_TOKEN", "")

contract_tokenizer = None
contract_model = None
privacy_tokenizer = None
privacy_model = None
threshold = DEFAULT_THRESHOLD
privacy_thresholds = {label: 0.5 for label in PRIVACY_LABELS}


class AnalyzeRequest(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_DOCUMENT_CHARACTERS)
    documentType: str | None = Field(default=None, max_length=200)


class CategoryScore(BaseModel):
    category: str
    confidence: float | None
    description: str
    kind: str


class Finding(BaseModel):
    text: str
    start: int
    end: int
    categories: list[CategoryScore]


class AnalyzeResponse(BaseModel):
    model: str
    threshold: float
    privacyModel: str | None
    privacyThresholds: dict[str, float]
    segmentCount: int
    flaggedCount: int
    findings: list[Finding]


def load_model():
    global contract_tokenizer, contract_model, privacy_tokenizer, privacy_model, threshold, privacy_thresholds
    config_path = Path(MODEL_ID) / "analysis_config.json"
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8"))
        threshold = float(config.get("threshold", DEFAULT_THRESHOLD))
    contract_tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    contract_model = AutoModelForSequenceClassification.from_pretrained(MODEL_ID)
    contract_model.eval()
    if PRIVACY_MODEL_ID:
        privacy_config_path = Path(PRIVACY_MODEL_ID) / "analysis_config.json"
        if privacy_config_path.exists():
            privacy_config = json.loads(privacy_config_path.read_text(encoding="utf-8"))
            privacy_thresholds.update({
                label: float(value)
                for label, value in privacy_config.get("thresholds", {}).items()
                if label in PRIVACY_LABELS
            })
        privacy_tokenizer = AutoTokenizer.from_pretrained(PRIVACY_MODEL_ID)
        privacy_model = AutoModelForSequenceClassification.from_pretrained(PRIVACY_MODEL_ID)
        privacy_model.eval()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()
    yield


app = FastAPI(title="Before You Agree LegalBERT", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "privacyModel": PRIVACY_MODEL_ID or None,
        "concreteRiskLabels": sorted(CONCRETE_RISK_LABELS),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest, authorization: str | None = Header(default=None)):
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Invalid analysis API token.")
    if contract_tokenizer is None or contract_model is None:
        raise HTTPException(status_code=503, detail="The LegalBERT model is not loaded.")

    contract_segments = sentence_segments(request.content)
    findings = []
    for offset in range(0, len(contract_segments), BATCH_SIZE):
        batch = contract_segments[offset : offset + BATCH_SIZE]
        inputs = contract_tokenizer(
            [segment["text"] for segment in batch],
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors="pt",
        )
        with torch.inference_mode():
            probabilities = torch.sigmoid(contract_model(**inputs).logits).cpu().tolist()

        for segment, scores in zip(batch, probabilities):
            detected = {
                LABELS[index]: round(float(score), 4)
                for index, score in enumerate(scores)
                if score >= threshold and LABELS[index] in CONCRETE_RISK_LABELS
            }
            risky_categories = filter_contract_risks(segment["text"], detected)
            categories = [
                {
                    "category": category,
                    "confidence": detected[category],
                    "description": LABEL_DESCRIPTIONS[category],
                    "kind": "contract_risk",
                }
                for category in risky_categories
            ]
            if categories:
                categories.sort(key=lambda item: item["confidence"], reverse=True)
                findings.append({**segment, "categories": categories})

    is_privacy_document = request.documentType is None or "privacy" in request.documentType.lower()
    privacy_segments = (
        contract_segments
        if privacy_model is not None and is_privacy_document
        else []
    )
    for offset in range(0, len(privacy_segments), BATCH_SIZE):
        batch = privacy_segments[offset : offset + BATCH_SIZE]
        inputs = privacy_tokenizer(
            [segment["text"] for segment in batch],
            padding=True,
            truncation=True,
            max_length=256,
            return_tensors="pt",
        )
        with torch.inference_mode():
            probabilities = torch.sigmoid(privacy_model(**inputs).logits).cpu().tolist()
        for segment, scores in zip(batch, probabilities):
            detected = {
                label: round(float(scores[index]), 4)
                for index, label in enumerate(PRIVACY_LABELS)
                if scores[index] >= privacy_thresholds[label]
            }
            risks = detect_privacy_risks(segment["text"], detected)
            categories = [
                {
                    "category": risk["category"],
                    "confidence": risk["confidence"],
                    "description": risk["description"],
                    "kind": "privacy_risk",
                }
                for risk in risks
            ]
            if categories:
                categories.sort(key=lambda item: item["confidence"] or 0, reverse=True)
                findings.append({**segment, "categories": categories})

    findings = merge_findings(findings)

    return {
        "model": MODEL_ID,
        "threshold": threshold,
        "privacyModel": PRIVACY_MODEL_ID or None,
        "privacyThresholds": privacy_thresholds if privacy_model is not None else {},
        "segmentCount": len(contract_segments),
        "flaggedCount": len(findings),
        "findings": findings,
    }


def merge_findings(findings):
    """Deduplicate the same clause and combine distinct risk categories."""
    merged = {}
    for finding in findings:
        clause_text = re.sub(r"^\s*(?:\d+[.)]|[-*])\s*", "", finding["text"])
        key = re.sub(r"[^a-z0-9]+", " ", clause_text.lower()).strip()
        if not key:
            continue
        existing = merged.get(key)
        if existing is None:
            merged[key] = {**finding, "categories": list(finding["categories"])}
            continue
        known = {(item["category"], item["kind"]) for item in existing["categories"]}
        existing["categories"].extend(
            item
            for item in finding["categories"]
            if (item["category"], item["kind"]) not in known
        )
        existing["start"] = min(existing["start"], finding["start"])
        existing["end"] = max(existing["end"], finding["end"])
    return sorted(merged.values(), key=lambda item: (item["start"], item["end"]))
