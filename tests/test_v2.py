"""v2.0 — billing, webhooks, language, aspect ML."""
import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app  # noqa: E402
from backend.services.language import detect_language  # noqa: E402
from backend.services.webhooks import sign_payload  # noqa: E402


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


class TestLanguage:
    def test_detect_english(self):
        lang, conf = detect_language("This movie was absolutely fantastic.")
        assert lang == "en"
        assert conf > 0.5

    def test_analyze_returns_language(self, client):
        r = client.post(
            "/api/analyze",
            json={"text": "A wonderful film with great acting.", "explain": False, "arc": False},
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert "language" in data


class TestBilling:
    def test_checkout_demo_key(self, client):
        r = client.post(
            "/api/billing/checkout",
            json={"email": "dev@test.com"},
            content_type="application/json",
        )
        assert r.status_code == 200
        data = json.loads(r.data)
        assert data.get("mode") == "demo"
        assert data.get("api_key", "").startswith("csk_live_")

    def test_billing_status(self, client):
        r = client.get("/api/billing/status")
        assert r.status_code == 200


class TestWebhooks:
    def test_hmac_signature(self):
        sig = sign_payload("secret", b'{"a":1}')
        assert len(sig) == 64

    def test_configure_webhook(self, client):
        r = client.put(
            "/api/developer/webhook",
            json={"webhook_url": "https://example.com/hook"},
            headers={"X-API-Key": "csk_demo_cinesentiment_local"},
            content_type="application/json",
        )
        assert r.status_code == 200
