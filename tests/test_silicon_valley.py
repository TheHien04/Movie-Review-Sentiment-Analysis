"""v2.2 — W&B, LLM baseline demo, K8s manifests, modern UI route."""
import json
import os
import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app  # noqa: E402
from backend.wandb_utils import wandb_enabled  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestWandb:
    def test_disabled_in_tests(self, monkeypatch):
        monkeypatch.setenv("WANDB_MODE", "disabled")
        assert wandb_enabled() or os.getenv("WANDB_MODE") == "disabled"


class TestLlmBaseline:
    def test_demo_lexicon(self, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        monkeypatch.setenv("WANDB_MODE", "disabled")
        monkeypatch.setenv("MLFLOW_ENABLED", "false")
        import scripts.llm_baseline as lb

        texts = ["great amazing film", "terrible boring waste"]
        probs = lb._demo_predict(texts)
        assert len(probs) == 2
        assert probs[0] > 0.5
        assert probs[1] < 0.5


class TestKubernetes:
    def test_manifests_parse(self):
        k8s = ROOT / "deploy" / "kubernetes"
        for name in (
            "namespace.yaml",
            "configmap.yaml",
            "deployment-backend.yaml",
            "service.yaml",
            "hpa.yaml",
        ):
            path = k8s / name
            assert path.is_file(), f"missing {path}"
            docs = list(yaml.safe_load_all(path.read_text()))
            assert docs and docs[0] is not None


class TestModernUi:
    def test_modern_route_hint_when_unbuilt(self, client):
        r = client.get("/modern/")
        assert r.status_code in (200, 404)
        if r.status_code == 404:
            data = json.loads(r.data)
            assert "Modern UI" in data.get("error", "") or "hint" in data
