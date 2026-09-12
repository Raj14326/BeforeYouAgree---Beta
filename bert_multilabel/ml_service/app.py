import hmac
import logging
import os
import torch
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from .model import CapacityError, RiskModel

log = logging.getLogger(__name__)


class Clause(BaseModel):
    clauseId: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=500000)


class PredictRequest(BaseModel):
    clauses: list[Clause] = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def validate_clauses(self):
        if len({c.clauseId for c in self.clauses}) != len(self.clauses):
            raise ValueError("Duplicate clause IDs")
        if any(not c.text.strip() for c in self.clauses):
            raise ValueError("Blank clause")
        if sum(len(c.text) for c in self.clauses) > 500000:
            raise ValueError("Document exceeds 500000 characters")
        return self


def create_app(loader=None):
    @asynccontextmanager
    async def lifespan(app):
        try:
            threads = int(os.getenv("BERT_CPU_THREADS", "8"))
            if threads < 1:
                raise ValueError("BERT_CPU_THREADS must be positive")
            torch.set_num_threads(threads)
            app.state.model = loader() if loader else RiskModel(
                os.getenv("BERT_MODEL_DIR", "ml/models/bert-multilabel-base-v1"),
                os.getenv("BERT_DEVICE", "cpu"),
                os.getenv("BERT_ALLOW_EXPERIMENTAL") == "1")
        except Exception:
            log.exception("Model failed to load; analysis will return 503")
        yield

    app = FastAPI(title="Before You Agree BERT", lifespan=lifespan)
    app.state.model = None
    lock = Lock()

    @app.get("/health")
    def health():
        ready = app.state.model is not None
        return JSONResponse({"status": "ready" if ready else "not_ready"}, status_code=200 if ready else 503)

    @app.post("/predict")
    def predict(body: PredictRequest, authorization: str = Header(default="")):
        key = os.getenv("BERT_API_KEY")
        if key and not hmac.compare_digest(authorization, f"Bearer {key}"):
            raise HTTPException(401, "Invalid service credentials")
        if app.state.model is None:
            raise HTTPException(503, "Trained BERT model is not ready")
        if not lock.acquire(blocking=False):
            raise HTTPException(429, "Model busy; retry later")
        try:
            return app.state.model.predict([c.model_dump() for c in body.clauses])
        except CapacityError as exc:
            raise HTTPException(413, str(exc)) from exc
        except Exception as exc:
            log.exception("Inference failed")
            raise HTTPException(503, "Analysis failed; no result produced") from exc
        finally:
            lock.release()

    return app


app = create_app()
