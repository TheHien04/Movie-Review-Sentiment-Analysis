"""
ML aspect classifier (TF-IDF + logistic) — optional upgrade over keyword tagging.
"""
from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

_PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = Path(os.getenv("ASPECT_MODEL_PATH", _PROJECT_ROOT / "artifacts" / "models" / "aspect_classifier.joblib"))
_META_PATH = MODEL_PATH.with_suffix(".json")

_pipeline = None
_meta: Optional[Dict[str, Any]] = None


def _load():
    global _pipeline, _meta
    if _pipeline is not None:
        return _pipeline
    if not MODEL_PATH.is_file():
        return None
    try:
        import joblib

        _pipeline = joblib.load(MODEL_PATH)
        if _META_PATH.is_file():
            _meta = json.loads(_META_PATH.read_text(encoding="utf-8"))
        logger.info("Loaded aspect classifier from %s", MODEL_PATH)
        return _pipeline
    except Exception as exc:
        logger.warning("Aspect classifier load failed: %s", exc)
        return None


def model_available() -> bool:
    return _load() is not None


def predict_aspect_sentences(
    sentences: List[str],
    aspects_per_sentence: List[List[str]],
) -> List[Dict[str, Any]]:
    """Predict label per (sentence, aspect) using trained pipeline."""
    pipe = _load()
    if pipe is None or not sentences:
        return []

    from backend.ml_core import format_single_prediction

    texts = []
    meta_rows = []
    for sent, asp_list in zip(sentences, aspects_per_sentence):
        for asp in asp_list:
            texts.append(f"[{asp}] {sent}")
            meta_rows.append((asp, sent))

    try:
        proba = pipe.predict_proba(texts)
        preds = pipe.predict(texts)
    except Exception as exc:
        logger.warning("Aspect ML predict failed: %s", exc)
        return []

    out = []
    for i, (asp, sent) in enumerate(meta_rows):
        pp = float(proba[i][1]) if proba.shape[1] > 1 else float(proba[i][0])
        pn = 1.0 - pp
        label = int(preds[i])
        row = format_single_prediction(label, pp, pn)
        row["id"] = asp
        row["text"] = sent
        out.append(row)
    return out


def analyze_aspects_ml(
    text: str,
    split_sentences_fn,
    sentence_aspects_fn,
    predict_batch: Callable[[List[str]], Tuple],
) -> Dict[str, Any]:
    """Hybrid: ML when model exists, else delegate to keyword analyze_aspects."""
    from backend.services.aspects import ASPECT_LABELS, analyze_aspects

    if not model_available():
        result = analyze_aspects(text, predict_batch)
        result["method"] = "keyword"
        return result

    sentences = split_sentences_fn(text, max_sentences=20)
    asp_lists = [sentence_aspects_fn(s) for s in sentences]
    if not any(asp_lists):
        return {
            "aspects": [],
            "coverage": 0.0,
            "method": "ml",
            "note": "No aspect keywords detected.",
        }

    ml_rows = predict_aspect_sentences(sentences, asp_lists)
    if not ml_rows:
        result = analyze_aspects(text, predict_batch)
        result["method"] = "keyword_fallback"
        return result

    buckets: Dict[str, List[Dict]] = {}
    for row in ml_rows:
        buckets.setdefault(row["id"], []).append(row)

    aspects_out = []
    for key, rows in buckets.items():
        fresh = sum(1 for r in rows if r["label"] == 1)
        aspects_out.append(
            {
                "id": key,
                "label": ASPECT_LABELS.get(key, key),
                "mentions": len(rows),
                "fresh_ratio": round(fresh / len(rows), 3),
                "sentiment": "positive" if fresh / len(rows) >= 0.5 else "negative",
                "label_id": 1 if fresh / len(rows) >= 0.5 else 0,
                "confidence": round(sum(r["confidence"] for r in rows) / len(rows), 4),
                "probability_positive": round(sum(r["probability_positive"] for r in rows) / len(rows), 4),
                "sample": rows[0]["text"][:120],
            }
        )

    covered = len(buckets)
    return {
        "aspects": aspects_out,
        "coverage": round(covered / len(ASPECT_LABELS), 3),
        "sentences_scanned": len(sentences),
        "method": "ml",
    }
