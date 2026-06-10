"""Pytest configuration — set env before backend.app is imported."""
import os

# Real fine-tuned classifier for CI/dev tests when IMDB weights are absent
os.environ.setdefault(
    "HUB_MODEL_FALLBACK", "distilbert-base-uncased-finetuned-sst-2-english"
)
os.environ.setdefault("RATE_LIMIT_ENABLED", "False")
os.environ.setdefault("CACHE_ENABLED", "False")
os.environ.setdefault("HUB_MODEL_MULTILINGUAL", "")
os.environ.setdefault("API_KEYS_REGISTRY", "/tmp/cinesentiment_test_api_keys.json")
