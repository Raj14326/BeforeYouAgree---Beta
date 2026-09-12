"""Local tiny BERT verifies plumbing, NOT risk accuracy; no network/downloads."""
import csv
import json
import subprocess
import sys
import os
import shutil
import socket
import time
import urllib.request

import pytest
import torch
from fastapi.testclient import TestClient
from transformers import BertConfig, BertForSequenceClassification, BertTokenizerFast

from .app import create_app
from .data import LABELS, audit_splits, choose_threshold, metrics, read_rows
from .model import CapacityError, RiskModel, encode, pooled_logits
from .multilabel_data import LABEL2ID as MULTILABEL2ID, LABEL_DEFINITIONS, choose_independent_thresholds


@pytest.fixture
def checkpoint(tmp_path):
    path = tmp_path / "tiny"
    path.mkdir()
    (path / "vocab.txt").write_text("\n".join([
        "[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]", "we", "may", "not", "sell", "data", ".", "refund"]), encoding="utf-8")
    tokenizer = BertTokenizerFast(vocab_file=str(path / "vocab.txt"))
    tokenizer.save_pretrained(path)
    config = BertConfig(vocab_size=len(tokenizer), hidden_size=16, num_hidden_layers=1,
                        num_attention_heads=2, intermediate_size=32, max_position_embeddings=64,
                        num_labels=2, label2id=LABELS, id2label={0: "not_risky", 1: "risky"})
    model = BertForSequenceClassification(config)
    model.save_pretrained(path)
    manifest = {"schema_version": 1, "status": "trained", "experimental": True,
                "model_id": "TEST-ONLY-RANDOM-NOT-A-RISK-MODEL", "aggregation": "max_logit",
                "base_model_source": "fixture/tiny-bert", "revision": "test-revision",
                "dataset_revisions": ["test-data-revision"],
                "training_data": {"dataset": "fixture/data", "subset": "test",
                                  "source_url": "https://example.com/test-data", "license": "test-only"},
                "label2id": LABELS, "threshold": 0.5, "review_margin": 0.1,
                "max_length": 16, "stride": 4}
    (path / "risk_config.json").write_text(json.dumps(manifest), encoding="utf-8")
    return path


@pytest.fixture
def multilabel_checkpoint(tmp_path):
    path = tmp_path / "tiny-multilabel"
    path.mkdir()
    (path / "vocab.txt").write_text("\n".join([
        "[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]", "we", "may", "terminate", "data", "."]), encoding="utf-8")
    tokenizer = BertTokenizerFast(vocab_file=str(path / "vocab.txt"))
    tokenizer.save_pretrained(path)
    config = BertConfig(vocab_size=len(tokenizer), hidden_size=16, num_hidden_layers=1,
                        num_attention_heads=2, intermediate_size=32, max_position_embeddings=64,
                        num_labels=8, label2id=MULTILABEL2ID,
                        id2label={value: key for key, value in MULTILABEL2ID.items()},
                        problem_type="multi_label_classification")
    BertForSequenceClassification(config).save_pretrained(path)
    manifest = {"schema_version": 2, "status": "trained", "experimental": True,
                "task": "multi_label_classification", "model_id": "TEST-8-LABEL",
                "architecture": "LEGAL-BERT-Base", "aggregation": "max_logit_per_label",
                "base_model": "fixture/tiny", "revision": "test", "dataset_revisions": ["test"],
                "training_data": {"dataset": "fixture/data", "subset": "test",
                                  "source_url": "https://example.com/data", "license": "test"},
                "labels": LABEL_DEFINITIONS, "label2id": MULTILABEL2ID,
                "thresholds": {item["id"]: 0.5 for item in LABEL_DEFINITIONS},
                "review_margin": 0.1, "max_length": 16, "stride": 4}
    (path / "risk_config.json").write_text(json.dumps(manifest), encoding="utf-8")
    return path


def test_experimental_model_requires_explicit_flag(checkpoint):
    with pytest.raises(ValueError, match="experimental"):
        RiskModel(checkpoint)


def test_real_bert_forward_covers_long_clause(checkpoint):
    model = RiskModel(checkpoint, allow_experimental=True)
    response = model.predict([{"clauseId": "a", "text": "we may not sell data. " * 15},
                              {"clauseId": "b", "text": "refund"}])
    assert len(response["findings"]) == 2
    assert response["findings"][0]["windowCount"] > 1
    assert response["findings"][1]["windowCount"] == 1
    assert all(0 <= f["riskProbability"] <= 1 for f in response["findings"])
    with pytest.raises(CapacityError):
        encode(model.tokenizer, ["we " * 100], 16, 4, 1)


def test_training_gradient_through_window_pooling(checkpoint):
    model = RiskModel(checkpoint, allow_experimental=True)
    model.model.train()
    encoded, mapping = encode(model.tokenizer, ["we " * 20, "refund"], 16, 4, 100)
    logits = pooled_logits(model.model, encoded, mapping, 2, "cpu", window_batch=1)
    loss = torch.nn.functional.cross_entropy(logits, torch.tensor([1, 0]))
    loss.backward()
    assert torch.isfinite(model.model.classifier.weight.grad).all()
    assert model.model.classifier.weight.grad.abs().sum() > 0


def test_eight_label_inference_and_independent_thresholds(multilabel_checkpoint):
    model = RiskModel(multilabel_checkpoint, allow_experimental=True)
    finding = model.predict([{"clauseId": "a", "text": "we may terminate."}])["findings"][0]
    assert len(finding["categories"]) == 8
    assert all(0 <= item["score"] <= 1 for item in finding["categories"])
    targets = [[float(i == j) for j in range(8)] for i in range(8)]
    scores = [[.9 if i == j else .1 for j in range(8)] for i in range(8)]
    thresholds, report = choose_independent_thresholds(targets, scores, min_recall=1.0)
    assert thresholds == [.9] * 8
    assert report["micro_f1"] == 1.0


def test_service_missing_model_returns_503():
    def missing():
        raise FileNotFoundError("missing")
    with TestClient(create_app(missing)) as client:
        assert client.get("/health").status_code == 503
        assert client.post("/predict", json={"clauses": [{"clauseId": "a", "text": "refund"}]}).status_code == 503


def test_service_with_real_model_auth_and_validation(checkpoint, monkeypatch):
    monkeypatch.setenv("BERT_API_KEY", "test-secret")
    with TestClient(create_app(lambda: RiskModel(checkpoint, allow_experimental=True))) as client:
        assert client.get("/health").status_code == 200
        body = {"clauses": [{"clauseId": "a", "text": "we may not sell data."}]}
        assert client.post("/predict", json=body).status_code == 401
        headers = {"Authorization": "Bearer test-secret"}
        result = client.post("/predict", json=body, headers=headers)
        assert result.status_code == 200
        assert result.json()["findings"][0]["clauseId"] == "a"
        body["clauses"].append(body["clauses"][0])
        assert client.post("/predict", json=body, headers=headers).status_code == 422


def test_leakage_and_threshold_selection():
    with pytest.raises(ValueError, match="overlapping"):
        audit_splits({"train": [{"group": "same", "hash": "1"}], "test": [{"group": "same", "hash": "2"}]})
    threshold, report = choose_threshold([0, 0, 1, 1], [0.1, 0.65, 0.7, 0.9], 1.0)
    assert 0.65 < threshold <= 0.7
    assert report["risky_precision"] == 1
    assert metrics([0, 1], [0.8, 0.1], 0.5)["confusion"] == {"tp": 0, "fp": 1, "fn": 1, "tn": 0}


def test_rejects_weak_labels_by_default(tmp_path):
    path = tmp_path / "weak.csv"
    path.write_text("document_id,text,label\na,refund,risky\nb,we may,not_risky\n", encoding="utf-8")
    with pytest.raises(ValueError, match="human_reviewed"):
        read_rows(path)


def test_train_save_reload_evaluate_cli(checkpoint, tmp_path):
    # Synthetic weak examples exercise the code path only; artifacts stay in tmp.
    files = {}
    for split, suffix in [("train", "we"), ("validation", "may"), ("test", "data")]:
        path = tmp_path / f"{split}.csv"
        with path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["document_id", "text", "label"])
            writer.writerow([split, f"refund {suffix}", "risky"])
            writer.writerow([split, f"not sell {suffix}", "not_risky"])
        files[split] = path
    output = tmp_path / "trained"
    command = [sys.executable, "-m", "ml_service.train", "--base-model", str(checkpoint),
               "--output", str(output), "--epochs", "1", "--max-length", "16", "--stride", "4",
               "--allow-weak-labels", "--device", "cpu"]
    for split, path in files.items():
        command += [f"--{split}", str(path)]
    subprocess.run(command, check=True, timeout=120)
    assert RiskModel(output, allow_experimental=True).manifest["experimental"]
    report = tmp_path / "report"
    subprocess.run([sys.executable, "-m", "ml_service.evaluate", "--model", str(output),
                    "--test", str(files["test"]), "--output", str(report), "--allow-weak-labels"],
                   check=True, timeout=120)
    assert json.loads((report / "metrics.json").read_text())["rows"] == 2


def test_live_node_to_python_to_bert(checkpoint, tmp_path):
    node = shutil.which("node")
    if not node:
        pytest.skip("Node is required for live integration")

    def port():
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            return sock.getsockname()[1]

    python_port, node_port = port(), port()
    while python_port == node_port:
        node_port = port()
    env = {**os.environ, "BERT_MODEL_DIR": str(checkpoint), "BERT_ALLOW_EXPERIMENTAL": "1",
           "BERT_DEVICE": "cpu", "BERT_API_KEY": "integration-secret",
           "BERT_SERVICE_URL": f"http://127.0.0.1:{python_port}",
           "PORT": str(node_port), "HOST": "127.0.0.1"}
    processes = []
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    with (tmp_path / "services.log").open("w") as log:
        try:
            for command in ([sys.executable, "-m", "uvicorn", "ml_service.app:app", "--host", "127.0.0.1", "--port", str(python_port)],
                            [node, "server/index.ts"]):
                processes.append(subprocess.Popen(command, env=env, stdout=log, stderr=log, creationflags=creationflags))
            for url in (f"http://127.0.0.1:{python_port}/health", f"http://127.0.0.1:{node_port}/api/health"):
                deadline = time.monotonic() + 45
                while True:
                    try:
                        with urllib.request.urlopen(url, timeout=1) as response:
                            assert response.status == 200
                        break
                    except OSError:
                        if time.monotonic() >= deadline or any(p.poll() is not None for p in processes):
                            raise AssertionError("Services failed to become ready; inspect services.log")
                        time.sleep(0.1)
            text = "  😀 We may not sell data.\n\nWe may not sell data.  "
            request = urllib.request.Request(f"http://127.0.0.1:{node_port}/api/analyze",
                        data=json.dumps({"content": text}).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=30) as response:
                result = json.load(response)
            assert result["clauseCount"] == 2
            assert result["coverage"] == "complete"
            assert result["model"] == "TEST-ONLY-RANDOM-NOT-A-RISK-MODEL"
            # JS offsets are UTF-16, even though Python indexes Unicode code points.
            utf16 = text.encode("utf-16-le")
            for finding in result["findings"]:
                assert utf16[finding["start"] * 2:finding["end"] * 2].decode("utf-16-le") == finding["text"]
        finally:
            for process in processes:
                process.terminate()
            for process in processes:
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
