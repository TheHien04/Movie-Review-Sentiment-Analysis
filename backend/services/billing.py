"""
Stripe billing — checkout sessions + webhook provisioning of Pro API keys.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

from backend.services.api_keys import generate_key, register_key

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "").strip()
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def stripe_enabled() -> bool:
    return bool(STRIPE_SECRET_KEY)


def _stripe():
    import stripe

    stripe.api_key = STRIPE_SECRET_KEY
    return stripe


def create_checkout_session(email: str) -> Dict[str, Any]:
    """Create Stripe Checkout or issue demo Pro key when Stripe is not configured."""
    email = (email or "").strip()
    if not email or "@" not in email:
        return {"error": "Valid email required"}

    if not stripe_enabled():
        api_key = generate_key("csk_live")
        register_key(api_key, tier="pro", email=email, stripe_session_id="demo")
        return {
            "mode": "demo",
            "message": "Stripe not configured — demo Pro API key issued (capstone mode).",
            "api_key": api_key,
            "tier": "pro",
        }

    stripe = _stripe()
    price = STRIPE_PRICE_ID or None
    line_items = (
        [{"price": price, "quantity": 1}]
        if price
        else [
            {
                "price_data": {
                    "currency": "usd",
                    "unit_amount": 2900,
                    "recurring": {"interval": "month"},
                    "product_data": {"name": "CineSentiment Pro API"},
                },
                "quantity": 1,
            }
        ]
    )
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer_email=email,
        line_items=line_items,
        success_url=f"{APP_BASE_URL}/developer.html?checkout=success",
        cancel_url=f"{APP_BASE_URL}/developer.html?checkout=cancel",
        metadata={"product": "cinesentiment_pro"},
    )
    return {"mode": "stripe", "checkout_url": session.url, "session_id": session.id}


def handle_stripe_webhook(payload: bytes, sig_header: str) -> Dict[str, Any]:
    if not stripe_enabled():
        return {"error": "Stripe not configured"}
    stripe = _stripe()
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
        else:
            import json

            event = stripe.Event.construct_from(json.loads(payload), stripe.api_key)
    except Exception as exc:
        logger.warning("Stripe webhook verify failed: %s", exc)
        return {"error": "invalid_signature"}

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        email = session.get("customer_email") or session.get("customer_details", {}).get("email", "")
        api_key = generate_key("csk_live")
        register_key(
            api_key,
            tier="pro",
            email=email or "",
            stripe_session_id=session.get("id", ""),
        )
        logger.info("Provisioned Pro API key for checkout session %s", session.get("id"))
        return {"ok": True, "provisioned": True, "key_mask": api_key[:7] + "…"}

    return {"ok": True, "ignored": event["type"]}
