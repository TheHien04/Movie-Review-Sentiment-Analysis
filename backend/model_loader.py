"""Shared model loading for Flask, FastAPI, and scripts."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from transformers import AutoModelForSequenceClassification, AutoTokenizer

from backend.ml_core import has_trained_weights

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_DIR = os.getenv(
    "MODEL_DIR",
    str(PROJECT_ROOT / "sentiment_model"),
)
MODEL_NAME = os.getenv("MODEL_NAME", "distilbert-base-uncased")
HF_MODEL_REVISION = os.getenv("HF_MODEL_REVISION", "main")


@dataclass
class InferenceBundle:
    tokenizer: object
    model: object
    model_source: str
    model_is_finetuned: bool


def _hub_fallback() -> str:
    explicit = os.getenv("HUB_MODEL_FALLBACK", "").strip()
    if explicit:
        return explicit
    if has_trained_weights(MODEL_DIR):
        return ""
    flask_env = os.getenv("FLASK_ENV", "development").lower()
    if flask_env in ("development", "dev", "local"):
        return "distilbert-base-uncased-finetuned-sst-2-english"
    return ""


def load_inference_bundle() -> InferenceBundle:
    hub = _hub_fallback()
    allow_untrained = os.getenv("ALLOW_UNTRAINED_BASE", "false").lower() == "true"

    if has_trained_weights(MODEL_DIR):
        tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
        model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)
        logger.info("Loaded fine-tuned weights from %s", MODEL_DIR)
        return InferenceBundle(tokenizer, model, "imdb_finetuned_local", True)

    if hub:
        tokenizer = AutoTokenizer.from_pretrained(hub, revision=HF_MODEL_REVISION)
        model = AutoModelForSequenceClassification.from_pretrained(hub, revision=HF_MODEL_REVISION)
        logger.warning("Using HUB_MODEL_FALLBACK=%s", hub)
        return InferenceBundle(tokenizer, model, "hub_fallback", True)

    if allow_untrained:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, revision=HF_MODEL_REVISION)
        model = AutoModelForSequenceClassification.from_pretrained(
            MODEL_NAME, revision=HF_MODEL_REVISION, num_labels=2
        )
        return InferenceBundle(tokenizer, model, "untrained_base", False)

    raise RuntimeError(
        "No trained model weights. Run: make train — or set HUB_MODEL_FALLBACK for dev."
    )


_bundle: InferenceBundle | None = None


def get_inference_bundle() -> InferenceBundle:
    global _bundle
    if _bundle is None:
        _bundle = load_inference_bundle()
        _bundle.model.eval()
    return _bundle
