"""Feast feature store + inline fallback for review text features."""
from __future__ import annotations

import hashlib
import os
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FEATURE_REPO = PROJECT_ROOT / "feature_repo"
ONLINE_STORE = PROJECT_ROOT / "data" / "feast" / "online_features.json"


def feast_enabled() -> bool:
    return os.getenv("FEAST_ENABLED", "true").lower() in ("1", "true", "yes")


def compute_text_features(text: str) -> dict[str, float]:
    words = text.split()
    wc = max(len(words), 1)
    return {
        "char_count": float(len(text)),
        "word_count": float(len(words)),
        "avg_word_len": float(sum(len(w) for w in words) / wc),
        "exclamation_count": float(text.count("!")),
        "question_count": float(text.count("?")),
    }


def _review_entity_id(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _load_online_cache() -> dict:
    if not ONLINE_STORE.is_file():
        return {}
    import json

    return json.loads(ONLINE_STORE.read_text(encoding="utf-8"))


def get_review_features(text: str, review_id: str | None = None) -> dict[str, Any]:
    """Online features for a review — Feast store when available, else computed inline."""
    entity_id = review_id or _review_entity_id(text)
    features = compute_text_features(text)
    source = "inline"

    if feast_enabled() and FEATURE_REPO.is_dir():
        try:
            from feast import FeatureStore

            fs = FeatureStore(repo_path=str(FEATURE_REPO))
            row = fs.get_online_features(
                features=[
                    "review_features:char_count",
                    "review_features:word_count",
                    "review_features:avg_word_len",
                    "review_features:exclamation_count",
                ],
                entity_rows=[{"review_id": entity_id}],
            ).to_dict()
            if row.get("char_count") and row["char_count"][0] is not None:
                features = {
                    "char_count": float(row["char_count"][0]),
                    "word_count": float(row["word_count"][0]),
                    "avg_word_len": float(row["avg_word_len"][0]),
                    "exclamation_count": float(row["exclamation_count"][0]),
                }
                source = "feast"
        except Exception:
            cached = _load_online_cache().get(entity_id)
            if cached:
                features = cached
                source = "feast_cache"

    return {"review_id": entity_id, "features": features, "source": source}
