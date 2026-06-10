"""
Unit tests for API endpoints (professional contract tests).
"""
import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app  # noqa: E402

EXPECTED_VERSION = (Path(__file__).resolve().parent.parent / "VERSION").read_text().strip()


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


class TestHealth:
    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["status"] == "healthy"
        assert "model_source" in data
        assert "model_is_finetuned" in data
        assert data.get("version") == EXPECTED_VERSION
        assert "inference_ready" in data
        assert "inference_message" in data

    def test_health_ready(self, client):
        r = client.get("/health/ready")
        assert r.status_code in (200, 503)
        data = json.loads(r.data)
        assert data["status"] in ("ready", "not_ready")
        assert "model_loaded" in data
        assert "inference_ready" in data

    def test_api_usage(self, client):
        r = client.get("/api/usage")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "daily_limit" in data
        assert "remaining" in data
        assert data["tier"] == "free"


class TestStatsReport:
    def test_stats_report(self, client):
        r = client.get("/api/stats-report")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert data["version"] == EXPECTED_VERSION
            assert "protocol" in data
            assert "splits" in data
            assert "test" in data["splits"]
            if data.get("hypothesis_tests"):
                assert "test" in data["hypothesis_tests"]
                assert "mcnemar" in data["hypothesis_tests"]["test"]

    def test_calibration_curve(self, client):
        r = client.get("/api/calibration-curve?split=val")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "mean_predicted" in data
            assert "brier_score" in data
            assert data["split"] == "val"

    def test_stats_report_fallback_artifact_route(self, client):
        r = client.get("/artifacts/results/evaluation.json")
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "splits" in data
            assert "test" in data["splits"]

    def test_serve_summary_html(self, client):
        r = client.get("/summary.html")
        assert r.status_code == 200
        assert b"STATISTICS REPORT" in r.data

    def test_api_path_not_served_as_static_file(self, client):
        r = client.get("/api/nonexistent-endpoint-xyz")
        assert r.status_code == 404
        data = json.loads(r.data)
        assert "error" in data


class TestInsightsAPI:
    def test_dashboard_summary(self, client):
        r = client.get("/api/dashboard-summary")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["version"] == EXPECTED_VERSION
        assert "features" in data
        assert "stats_report_api" in data["features"]
        assert "calibration_reliability_curve" in data["features"]

    def test_threshold_curve(self, client):
        r = client.get("/api/threshold-curve?split=val")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert data["split"] == "val"
            assert isinstance(data.get("points"), list)
            if data["points"]:
                assert "f1" in data["points"][0]

    def test_roc_curve(self, client):
        r = client.get("/api/roc-curve?split=val")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "fpr" in data and "tpr" in data

    def test_pr_curve(self, client):
        r = client.get("/api/pr-curve?split=val")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "precision" in data and "recall" in data
            assert data["split"] == "val"

    def test_insights_curves_bundle(self, client):
        r = client.get("/api/insights-curves?split=val")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "roc_curve" in data
            assert "threshold_curve" in data
            assert data["split"] == "val"

    def test_statistical_summary(self, client):
        r = client.get("/api/statistical-summary?split=val")
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert data["split"] == "val"
            assert "derived" in data
            assert "metrics" in data

    def test_error_analysis_api(self, client):
        r = client.get("/api/error-analysis?limit=10")
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "rows" in data
            assert "counts" in data


class TestInsightsPage:
    def test_serve_insights_html(self, client):
        r = client.get("/insights.html")
        assert r.status_code == 200
        assert b"RESEARCH INSIGHTS" in r.data


class TestExplainAPI:
    def test_explain_returns_tokens(self, client):
        r = client.post(
            "/api/explain",
            json={"text": "This movie was fantastic and wonderfully acted."},
        )
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "tokens" in data
            assert "label" in data
            assert "method" in data
            assert data["method"] == "input_x_gradient"
            assert len(data["tokens"]) > 0
            assert all("score" in t for t in data["tokens"])

    def test_explain_empty_text_400(self, client):
        r = client.post("/api/explain", json={"text": ""})
        assert r.status_code == 400


class TestPredictAPI:
    def test_predict_positive_review(self, client):
        r = client.post(
            "/api/predict",
            json={"text": "This movie was absolutely fantastic! Amazing acting and plot."},
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "label" in data
        assert "confidence" in data
        assert "probability_positive" in data
        assert 0 <= data["confidence"] <= 1

    def test_predict_empty_text_returns_400(self, client):
        r = client.post("/api/predict", json={"text": ""}, content_type="application/json")
        assert r.status_code == 400

    def test_predict_missing_text_returns_400(self, client):
        r = client.post("/api/predict", json={}, content_type="application/json")
        assert r.status_code == 400


class TestAnalyzeAPI:
    def test_analyze_full_response(self, client):
        r = client.post(
            "/api/analyze",
            json={
                "text": "A stunning opening act. The finale however felt rushed and disappointing.",
                "explain": True,
                "arc": True,
            },
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "label" in data
        assert "explanation" in data
        assert "tokens" in data["explanation"]
        assert "arc" in data
        assert len(data["arc"]) >= 2

    def test_analyze_empty_text_400(self, client):
        r = client.post("/api/analyze", json={"text": ""}, content_type="application/json")
        assert r.status_code == 400


class TestAspectsAPI:
    def test_aspects_endpoint(self, client):
        r = client.post(
            "/api/aspects",
            json={
                "text": (
                    "The acting is phenomenal and the cast shines. "
                    "Unfortunately the plot drags and pacing feels slow. "
                    "Stunning cinematography and a powerful score."
                )
            },
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "aspects" in data
        assert len(data["aspects"]) >= 2
        ids = {a["id"] for a in data["aspects"]}
        assert "acting" in ids or "visuals" in ids

    def test_analyze_includes_aspects(self, client):
        r = client.post(
            "/api/analyze",
            json={"text": "Great performances but a weak script.", "aspects": True},
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "aspects" in data


class TestDeveloperAPI:
    def test_developer_me_demo_key(self, client):
        r = client.get("/api/developer/me", headers={"X-API-Key": "csk_demo_cinesentiment_local"})
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["valid"] is True
        assert data["tier"] == "developer"
        assert "usage" in data

    def test_developer_me_invalid(self, client):
        r = client.get("/api/developer/me", headers={"X-API-Key": "invalid"})
        assert r.status_code == 403


class TestSampleDownloads:
    def test_sample_csv(self, client):
        r = client.get("/api/sample.csv")
        assert r.status_code == 200
        assert b"text" in r.data.lower()

    def test_sample_batch_csv(self, client):
        r = client.get("/api/sample-batch.csv")
        assert r.status_code == 200
        assert b"text" in r.data.lower()


class TestPredictConfidenceAPI:
    def test_predict_confidence_endpoint(self, client):
        r = client.post(
            "/api/predict/confidence",
            json={"text": "A masterpiece of modern cinema with stunning visuals."},
            content_type="application/json",
        )
        assert r.status_code in (200, 503)
        if r.status_code == 200:
            data = json.loads(r.data)
            assert "confidence" in data or "probability_positive" in data

    def test_predict_confidence_empty_400(self, client):
        r = client.post(
            "/api/predict/confidence", json={"text": ""}, content_type="application/json"
        )
        assert r.status_code == 400


class TestMLCore:
    def test_compute_classification_metrics(self):
        from backend.ml_core import compute_classification_metrics
        import numpy as np

        y_true = np.array([0, 0, 1, 1])
        y_prob = np.array([0.1, 0.4, 0.6, 0.9])
        metrics = compute_classification_metrics(y_true, y_prob, threshold=0.5)
        assert "accuracy" in metrics
        assert "f1" in metrics
        assert "precision" in metrics
        assert "recall" in metrics
        assert 0 <= metrics["accuracy"] <= 1

    def test_sanitize_for_json(self):
        from backend.ml_core import sanitize_for_json

        result = sanitize_for_json({"a": float("nan"), "b": float("inf"), "c": 1.0})
        assert result["c"] == 1.0
        assert result["a"] is None or result["a"] == 0

    def test_bootstrap_metric_cis(self):
        from backend.ml_core import bootstrap_metric_cis
        import numpy as np

        rng = np.random.RandomState(42)
        y_true = rng.randint(0, 2, size=200)
        y_prob = np.clip(y_true + rng.normal(0, 0.3, size=200), 0, 1)
        cis = bootstrap_metric_cis(y_true, y_prob, threshold=0.5, n_bootstrap=50)
        assert isinstance(cis, dict)
        assert len(cis) > 0


class TestMetricsAPI:
    def test_metrics_val_split(self, client):
        r = client.get("/api/metrics?split=val&threshold=0.5&recompute=true")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["data_source"] == "computed"
        assert "accuracy" in data
        assert "f1" in data
        assert "confusion_matrix" in data
        assert data["split"] == "val"
        assert 0 <= data["accuracy"] <= 1

    def test_metrics_invalid_threshold(self, client):
        r = client.get("/api/metrics?threshold=2.0")
        assert r.status_code == 400

    def test_metrics_invalid_split(self, client):
        r = client.get("/api/metrics?split=train")
        assert r.status_code == 400


class TestDatasetAPI:
    def test_dataset_info_from_raw_data(self, client):
        r = client.get("/api/dataset-info")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["data_source"] == "measured"
        assert data["statistics"]["train_samples"] > 1000
        assert len(data["samples"]) > 0


class TestModelComparison:
    def test_model_comparison_endpoint(self, client):
        r = client.get("/api/model-comparison?split=test")
        assert r.status_code in (200, 503)
        data = json.loads(r.data)
        if r.status_code == 200:
            assert len(data["models"]) >= 2
            assert data["split"] == "test"
            assert "deltas" in data


class TestModelInfo:
    def test_model_info(self, client):
        r = client.get("/api/model-info")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "training" in data
        assert "has_trained_weights" in data["training"]
        assert data["training"]["training_status"] in ("finetuned", "not_finetuned")


class TestOpenAPI:
    def test_openapi_yaml(self, client):
        r = client.get("/api/openapi.yaml")
        assert r.status_code == 200
        assert b"openapi:" in r.data

    def test_api_docs_html(self, client):
        r = client.get("/api/docs", follow_redirects=True)
        assert r.status_code == 200
        assert b"swagger" in r.data.lower()
        assert b"API REFERENCE" in r.data


class TestCapstoneStatus:
    def test_capstone_status(self, client):
        r = client.get("/api/capstone-status")
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data["version"] == EXPECTED_VERSION
        assert "items" in data
        assert "score_label" in data
        assert isinstance(data["ready"], bool)

    def test_serve_checklist_html(self, client):
        r = client.get("/checklist.html")
        assert r.status_code == 200
        assert b"DEFENSE CHECKLIST" in r.data
        assert b"checklist-page.css" in r.data

    def test_evaluation_artifact_strict_json(self, client):
        r = client.get("/artifacts/results/evaluation.json")
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            text = r.data.decode("utf-8")
            assert "Infinity" not in text
            data = json.loads(text)
            assert "splits" in data


class TestStaticFiles:
    def test_serve_index(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert b"<!DOCTYPE html>" in r.data
