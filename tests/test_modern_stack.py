"""v2.1 — MLflow utils, Prometheus, FastAPI, RAG API surface."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app  # noqa: E402
from backend.mlflow_utils import mlflow_enabled, tracking_uri  # noqa: E402


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestPrometheus:
    def test_metrics_endpoint(self, client):
        r = client.get("/metrics")
        assert r.status_code == 200
        assert b"cinesentiment_http_requests" in r.data or b"# HELP" in r.data


class TestRagApi:
    def test_rag_stats(self, client):
        r = client.get("/api/rag/stats")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "enabled" in data

    def test_rag_query_empty_index(self, client):
        r = client.post(
            "/api/rag/query",
            json={"text": "stunning visuals and weak plot", "k": 3},
            content_type="application/json",
        )
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "matches" in data


class TestMlflowUtils:
    def test_tracking_uri_default(self):
        uri = tracking_uri()
        assert "mlruns" in uri or uri.startswith("file:")

    def test_mlflow_run_noop_when_disabled(self, monkeypatch):
        monkeypatch.setenv("MLFLOW_ENABLED", "false")
        from backend.mlflow_utils import mlflow_run

        with mlflow_run("test-exp") as run:
            assert run is None


class TestFastAPI:
    def test_health(self):
        pytest.importorskip("fastapi")
        from fastapi.testclient import TestClient

        from backend.fastapi_app import app as fastapi_app

        with TestClient(fastapi_app) as c:
            r = c.get("/health")
            assert r.status_code == 200
            assert r.json()["runtime"] == "fastapi"

    def test_predict_v2(self):
        pytest.importorskip("fastapi")
        from fastapi.testclient import TestClient

        from backend.fastapi_app import app as fastapi_app

        with TestClient(fastapi_app) as c:
            r = c.post("/api/v2/predict", json={"text": "A brilliant masterpiece of cinema."})
            assert r.status_code == 200
            body = r.json()
            assert "label" in body
            assert body["api"] == "fastapi-v2"
