"""v2.3 — LangGraph, vLLM/Triton adapters, Feast, Istio, multi-region manifests."""
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
import yaml

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app  # noqa: E402
from backend.services.agent_graph import agent_enabled, run_sentiment_agent  # noqa: E402
from backend.services.feature_store import compute_text_features, get_review_features  # noqa: E402
from backend.services.remote_inference import backend_info, inference_backend  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestLangGraphAgent:
    def test_agent_enabled_default(self):
        assert agent_enabled() is True

    def test_agent_pipeline(self):
        result = run_sentiment_agent("A brilliant masterpiece with stunning visuals.")
        assert result.get("orchestrator") == "langgraph"
        assert result["sentiment"] in ("positive", "negative")
        assert "predict:ok" in result.get("steps", [])
        assert "summarize:ok" in result.get("steps", [])

    def test_agent_api(self, client):
        r = client.post(
            "/api/agent/analyze",
            json={"text": "Terrible waste of time, very boring."},
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["orchestrator"] == "langgraph"
        assert data["sentiment"] == "negative"


class TestRemoteInference:
    def test_backend_default_local(self, monkeypatch):
        monkeypatch.delenv("INFERENCE_BACKEND", raising=False)
        assert inference_backend() == "local"

    def test_backend_info(self):
        info = backend_info()
        assert "vllm_base_url" in info
        assert "triton_url" in info

    def test_vllm_mock(self, monkeypatch):
        monkeypatch.setenv("INFERENCE_BACKEND", "vllm")
        mock_resp = MagicMock()
        mock_resp.choices = [MagicMock(message=MagicMock(content="POSITIVE"))]
        mock_client = MagicMock()
        mock_client.chat.completions.create.return_value = mock_resp
        with patch("openai.OpenAI", return_value=mock_client):
            from backend.services.remote_inference import try_remote_predict

            labels, prob_pos, _ = try_remote_predict(["great film"])
        assert labels[0] == 1
        assert prob_pos[0] > 0.5


class TestFeatureStore:
    def test_compute_features(self):
        feats = compute_text_features("Wow! Great movie!!!")
        assert feats["word_count"] == 3
        assert feats["exclamation_count"] == 4

    def test_get_review_features_inline(self, monkeypatch):
        monkeypatch.setenv("FEAST_ENABLED", "false")
        out = get_review_features("A solid drama with good pacing.")
        assert out["source"] == "inline"
        assert "word_count" in out["features"]

    def test_features_api(self, client):
        r = client.post("/api/features", json={"text": "Short review."})
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "features" in data


class TestDeployManifests:
    def test_istio_manifests(self):
        istio = ROOT / "deploy" / "kubernetes" / "istio"
        for name in ("gateway.yaml", "virtualservice.yaml", "destinationrule.yaml", "peerauthentication.yaml"):
            docs = list(yaml.safe_load_all((istio / name).read_text()))
            assert docs[0]["kind"]

    def test_multi_region_ingress(self):
        path = ROOT / "deploy" / "kubernetes" / "multi-region" / "geo-ingress.yaml"
        doc = yaml.safe_load(path.read_text())
        assert doc["kind"] == "Ingress"
        hosts = [r["host"] for r in doc["spec"]["rules"]]
        assert "us-east.cinesentiment.example.com" in hosts

    def test_triton_model_repo(self):
        cfg = ROOT / "deploy" / "triton" / "model_repository" / "distilbert_sentiment" / "config.pbtxt"
        assert "distilbert_sentiment" in cfg.read_text()

    def test_helm_region_values(self):
        for name in ("values-us-east.yaml", "values-eu-west.yaml"):
            data = yaml.safe_load((ROOT / "deploy" / "helm" / "cinesentiment" / name).read_text())
            assert "region" in data
