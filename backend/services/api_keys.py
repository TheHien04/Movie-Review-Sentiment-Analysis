"""
API key registry — env keys + persisted Pro keys (Stripe-provisioned).
"""
from __future__ import annotations

import json
import os
import secrets
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

_REGISTRY_LOCK = threading.Lock()
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = Path(os.getenv("API_KEYS_REGISTRY", _PROJECT_ROOT / "data" / "api_keys_registry.json"))


def _parse_keys(raw: str) -> Set[str]:
    return {k.strip() for k in raw.split(",") if k.strip()}


def _empty_registry() -> Dict[str, Any]:
    return {"keys": {}}


def _load_registry() -> Dict[str, Any]:
    if not REGISTRY_PATH.is_file():
        return _empty_registry()
    try:
        with REGISTRY_PATH.open(encoding="utf-8") as fh:
            data = json.load(fh)
        if "keys" not in data:
            return _empty_registry()
        return data
    except (json.JSONDecodeError, OSError):
        return _empty_registry()


def _save_registry(data: Dict[str, Any]) -> None:
    REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = REGISTRY_PATH.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
    tmp.replace(REGISTRY_PATH)


def load_valid_keys() -> Set[str]:
    keys: Set[str] = set()
    env_keys = os.getenv("API_KEYS", "")
    if env_keys:
        keys |= _parse_keys(env_keys)
    if os.getenv("API_KEYS_DEMO", "true").lower() == "true":
        keys.add(os.getenv("API_KEY_DEMO", "csk_demo_cinesentiment_local"))
    with _REGISTRY_LOCK:
        reg = _load_registry()
        keys |= set(reg.get("keys", {}).keys())
    return keys


def get_key_record(api_key: str) -> Optional[Dict[str, Any]]:
    with _REGISTRY_LOCK:
        reg = _load_registry()
        return reg.get("keys", {}).get(api_key)


def register_key(
    api_key: str,
    *,
    tier: str = "pro",
    email: str = "",
    stripe_session_id: str = "",
    webhook_url: str = "",
    webhook_secret: str = "",
) -> Dict[str, Any]:
    record = {
        "tier": tier,
        "email": email,
        "stripe_session_id": stripe_session_id,
        "webhook_url": webhook_url,
        "webhook_secret": webhook_secret or secrets.token_hex(16),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with _REGISTRY_LOCK:
        reg = _load_registry()
        reg.setdefault("keys", {})[api_key] = record
        _save_registry(reg)
    return record


def update_key_webhook(api_key: str, webhook_url: str, webhook_secret: Optional[str] = None) -> bool:
    with _REGISTRY_LOCK:
        reg = _load_registry()
        if api_key not in reg.get("keys", {}):
            return False
        reg["keys"][api_key]["webhook_url"] = webhook_url.strip()
        if webhook_secret is not None:
            reg["keys"][api_key]["webhook_secret"] = webhook_secret.strip()
        _save_registry(reg)
    return True


def key_tier(api_key: str) -> str:
    if not api_key:
        return "free"
    rec = get_key_record(api_key)
    if rec:
        return rec.get("tier", "pro")
    if api_key.startswith("csk_live_"):
        return "pro"
    if api_key.startswith("csk_demo_"):
        return "developer"
    return "pro" if api_key in load_valid_keys() else "free"


def validate_api_key(api_key: Optional[str]) -> bool:
    if not api_key:
        return False
    return api_key in load_valid_keys()


def daily_limit_for_tier(tier: str) -> int:
    return {
        "free": int(os.getenv("FREE_DAILY_LIMIT", "50")),
        "developer": int(os.getenv("DEVELOPER_DAILY_LIMIT", "500")),
        "pro": int(os.getenv("PRO_DAILY_LIMIT", "10000")),
    }.get(tier, 50)


def mask_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "***"
    return api_key[:7] + "…" + api_key[-4:]


def generate_key(prefix: str = "csk_live") -> str:
    return f"{prefix}_{secrets.token_urlsafe(24)}"


def developer_info(api_key: str) -> Dict[str, Any]:
    tier = key_tier(api_key) if validate_api_key(api_key) else "invalid"
    rec = get_key_record(api_key) or {}
    webhook_url = rec.get("webhook_url", "")
    return {
        "valid": tier != "invalid",
        "tier": tier,
        "key_mask": mask_key(api_key),
        "daily_limit": daily_limit_for_tier(tier) if tier != "invalid" else 0,
        "webhook_configured": bool(webhook_url),
        "webhook_url_mask": (webhook_url[:32] + "…") if len(webhook_url) > 35 else webhook_url,
        "features": [
            "predict",
            "analyze",
            "explain",
            "batch_stream",
            "aspects",
            "webhooks",
            "multilingual",
        ],
    }
