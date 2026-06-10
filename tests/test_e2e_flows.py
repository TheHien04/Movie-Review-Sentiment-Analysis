"""
End-to-end user flows via Flask test client (no browser required in CI).
"""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app  # noqa: E402


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestUserFlows:
    """Smoke E2E: pages load and core predict → explain flow works."""

    @pytest.mark.parametrize(
        "path",
        [
            "/",
            "/batch.html",
            "/evaluation.html",
            "/insights.html",
            "/summary.html",
            "/checklist.html",
            "/compare.html",
            "/dataset.html",
            "/api-docs.html",
        ],
    )
    def test_page_loads(self, client, path):
        r = client.get(path)
        assert r.status_code == 200
        assert b"<!DOCTYPE html>" in r.data or b"<html" in r.data

    def test_predict_then_explain_flow(self, client):
        text = "This film was absolutely wonderful and deeply moving."
        r = client.post(
            "/api/predict",
            json={"text": text},
            content_type="application/json",
        )
        assert r.status_code == 200
        pred = json.loads(r.data)
        assert "label" in pred
        assert "confidence" in pred

        r2 = client.post(
            "/api/explain",
            json={"text": text},
            content_type="application/json",
        )
        assert r2.status_code == 200
        expl = json.loads(r2.data)
        assert expl["method"] == "input_x_gradient"
        assert len(expl["tokens"]) > 0

    def test_capstone_to_stats_flow(self, client):
        r = client.get("/api/capstone-status")
        assert r.status_code == 200
        status = json.loads(r.data)
        assert "ready" in status

        r2 = client.get("/api/stats-report")
        assert r2.status_code in (200, 503)

    def test_openapi_spec_available(self, client):
        r = client.get("/api/openapi.yaml")
        assert r.status_code == 200
        assert b"openapi:" in r.data

    def test_security_headers_on_html(self, client):
        r = client.get("/")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"
        assert r.headers.get("X-Frame-Options") == "SAMEORIGIN"
