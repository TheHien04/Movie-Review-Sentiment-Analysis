"""
Outbound webhooks for batch completion (HMAC-signed JSON).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from typing import Any, Dict, Optional

import urllib.request

logger = logging.getLogger(__name__)


def sign_payload(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()


def build_batch_payload(
    event: str,
    results: list,
    *,
    filename: str = "",
    model_source: str = "",
    total: Optional[int] = None,
) -> Dict[str, Any]:
    return {
        "event": event,
        "timestamp": time.time(),
        "filename": filename,
        "model_source": model_source,
        "total": total if total is not None else len(results),
        "results": results,
    }


def dispatch_webhook(
    url: str,
    secret: str,
    payload: Dict[str, Any],
    *,
    timeout: float = 10.0,
) -> Dict[str, Any]:
    """POST signed JSON to customer URL. Returns status dict (never raises)."""
    if not url or not url.startswith(("http://", "https://")):
        return {"ok": False, "error": "invalid_webhook_url"}

    body = json.dumps(payload, default=str).encode("utf-8")
    sig = sign_payload(secret or "", body)
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "CineSentiment-Webhook/2.0",
            "X-CineSentiment-Signature": f"sha256={sig}",
            "X-CineSentiment-Event": str(payload.get("event", "unknown")),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            code = resp.getcode()
            return {"ok": 200 <= code < 300, "status_code": code}
    except Exception as exc:
        logger.warning("Webhook dispatch failed: %s", exc)
        return {"ok": False, "error": str(exc)}
