import hashlib
import json
import os
from pathlib import Path
import sys
import time
from functools import wraps

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
from io import StringIO

import numpy as np
import pandas as pd
import torch
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, redirect, request, send_from_directory
from flask_caching import Cache
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from werkzeug.utils import secure_filename

from backend.services.api_keys import (
    daily_limit_for_tier,
    developer_info,
    get_key_record,
    key_tier,
    update_key_webhook,
    validate_api_key,
)
from backend.services.aspect_classifier import analyze_aspects_ml
from backend.services.aspects import analyze_aspects
from backend.services.billing import create_checkout_session, handle_stripe_webhook, stripe_enabled
from backend.services.language import detect_language, needs_multilingual_model
from backend.services.multilingual import hub_model_id, multilingual_available, predict_multilingual
from backend.services.webhooks import build_batch_payload, dispatch_webhook
from backend.services.explainability import explain_input_gradient
from backend.services.inference import predict_sentiment as run_inference
from backend.ml_core import (
    ARTIFACTS_DIR,
    bootstrap_metric_cis,
    build_stats_report,
    capstone_readiness,
    calibration_curve_points,
    sanitize_for_json,
    compute_classification_metrics,
    dataset_summary,
    default_test_path,
    default_train_path,
    default_val_path,
    derived_classification_stats,
    format_single_prediction,
    split_review_sentences,
    has_trained_weights,
    load_evaluation_artifact,
    metric_deltas,
    optimal_threshold_from_curve,
    pr_curve_points,
    read_labeled_csv,
    roc_curve_points,
    threshold_curve_points,
)

def _read_version() -> str:
    vfile = Path(__file__).resolve().parent.parent / "VERSION"
    try:
        return vfile.read_text().strip()
    except FileNotFoundError:
        return "0.0.0"

APP_VERSION = _read_version()

load_dotenv()

# --- Logging (stdlib only; configured before other imports log) ---
import logging

log_level = os.getenv("LOG_LEVEL", "INFO")
log_file = os.getenv("LOG_FILE", "app.log")
log_dir = os.path.dirname(log_file)
if log_dir and not os.path.exists(log_dir):
    os.makedirs(log_dir, exist_ok=True)

logging.basicConfig(
    level=getattr(logging, log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# --- Paths & config ---
MODEL_DIR = os.getenv(
    "MODEL_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "../sentiment_model"))
)
MODEL_NAME = os.getenv("MODEL_NAME", "distilbert-base-uncased")
HF_MODEL_REVISION = os.getenv("HF_MODEL_REVISION", "main")


def _load_tokenizer(path_or_id: str, *, local_only: bool = False):
    if local_only:
        return AutoTokenizer.from_pretrained(path_or_id, local_files_only=True)
    return AutoTokenizer.from_pretrained(path_or_id, revision=HF_MODEL_REVISION)


def _load_classifier(path_or_id: str, *, local_only: bool = False, num_labels=None):
    if local_only:
        return AutoModelForSequenceClassification.from_pretrained(path_or_id, local_files_only=True)
    if num_labels is not None:
        return AutoModelForSequenceClassification.from_pretrained(
            path_or_id, revision=HF_MODEL_REVISION, num_labels=num_labels
        )
    return AutoModelForSequenceClassification.from_pretrained(path_or_id, revision=HF_MODEL_REVISION)


def _resolve_hub_fallback() -> str:
    """Use explicit env, else auto-enable SST-2 fallback in local dev when IMDB weights are absent."""
    explicit = os.getenv("HUB_MODEL_FALLBACK", "").strip()
    if explicit:
        return explicit
    if has_trained_weights(MODEL_DIR):
        return ""
    flask_env = os.getenv("FLASK_ENV", "development").lower()
    if flask_env in ("development", "dev", "local"):
        return "distilbert-base-uncased-finetuned-sst-2-english"
    return ""


HUB_MODEL_FALLBACK = _resolve_hub_fallback()
ALLOW_UNTRAINED_BASE = os.getenv("ALLOW_UNTRAINED_BASE", "false").lower() == "true"
METRICS_MAX_ROWS = int(os.getenv("METRICS_MAX_ROWS", "0"))  # 0 = full split
BOOTSTRAP_SAMPLES = int(os.getenv("BOOTSTRAP_SAMPLES", "500"))

ALLOWED_EXTENSIONS = set(os.getenv("ALLOWED_FILE_EXTENSIONS", "csv").split(","))
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", 10)) * 1024 * 1024
MAX_TEXT_CHARS = int(os.getenv("MAX_TEXT_LENGTH", os.getenv("MAX_SEQUENCE_LENGTH", "10000")))
FREE_DAILY_LIMIT = int(os.getenv("FREE_DAILY_LIMIT", "50"))
_usage_counts: dict = {}


def _usage_day_key() -> str:
    return time.strftime("%Y-%m-%d")


def _get_api_key() -> str:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return (request.headers.get("X-API-Key") or "").strip()


def _usage_client_key() -> str:
    key = _get_api_key()
    if key and validate_api_key(key):
        return f"apikey:{hashlib.sha256(key.encode()).hexdigest()[:16]}"
    return get_remote_address() or "anonymous"


def _client_daily_limit() -> int:
    key = _get_api_key()
    if key and validate_api_key(key):
        return daily_limit_for_tier(key_tier(key))
    return FREE_DAILY_LIMIT


def _record_api_usage(n: int = 1) -> int:
    """Track inference calls per client per day (in-memory; use Redis in multi-worker prod)."""
    n = max(1, int(n))
    bucket = f"{_usage_client_key()}:{_usage_day_key()}"
    _usage_counts[bucket] = _usage_counts.get(bucket, 0) + n
    return _usage_counts[bucket]


def _get_api_usage() -> int:
    bucket = f"{_usage_client_key()}:{_usage_day_key()}"
    return int(_usage_counts.get(bucket, 0))


def _load_model_and_tokenizer():
    """Load fine-tuned local weights, hub fallback (CI), or optional untrained base."""
    if has_trained_weights(MODEL_DIR):
        tokenizer = _load_tokenizer(MODEL_DIR, local_only=True)
        model = _load_classifier(MODEL_DIR, local_only=True)
        source = "imdb_finetuned_local"
        logger.info("Loaded fine-tuned weights from %s", MODEL_DIR)
        return tokenizer, model, source, True

    if HUB_MODEL_FALLBACK:
        tokenizer = _load_tokenizer(HUB_MODEL_FALLBACK)
        model = _load_classifier(HUB_MODEL_FALLBACK)
        logger.warning("Using HUB_MODEL_FALLBACK=%s (not project-specific IMDB weights)", HUB_MODEL_FALLBACK)
        return tokenizer, model, "hub_fallback", True

    if ALLOW_UNTRAINED_BASE:
        tokenizer = _load_tokenizer(MODEL_NAME)
        model = _load_classifier(MODEL_NAME, num_labels=2)
        logger.warning(
            "ALLOW_UNTRAINED_BASE=true: classifier head is random. Run: python scripts/model_training.py"
        )
        return tokenizer, model, "untrained_base", False

    try:
        tokenizer = _load_tokenizer(MODEL_DIR, local_only=True)
        model = _load_classifier(MODEL_NAME, num_labels=2)
        logger.warning("Tokenizer from %s but no weights; using untrained %s", MODEL_DIR, MODEL_NAME)
        return tokenizer, model, "untrained_base", False
    except Exception as exc:
        raise RuntimeError(
            "No trained model weights found. Train with: python scripts/model_training.py "
            "or set HUB_MODEL_FALLBACK for development."
        ) from exc


logger.info("Loading NLP model...")
tokenizer, model, MODEL_SOURCE, MODEL_IS_FINETUNED = _load_model_and_tokenizer()
model.eval()

app = Flask(__name__, static_folder="../frontend")

_secret = os.getenv("SECRET_KEY", "")
_flask_env = os.getenv("FLASK_ENV", "development").lower()
_is_dev = _flask_env in ("development", "dev", "local")
if not _secret and not _is_dev:
    raise RuntimeError(
        "SECRET_KEY environment variable is required in production. "
        "Set it in .env or as an environment variable."
    )
app.config["SECRET_KEY"] = _secret or "dev-only-insecure-key"
app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

cache_enabled = os.getenv("CACHE_ENABLED", "True").lower() == "true"
cache = Cache(
    app,
    config={
        "CACHE_TYPE": os.getenv("CACHE_TYPE", "simple"),
        "CACHE_DEFAULT_TIMEOUT": int(os.getenv("CACHE_DEFAULT_TIMEOUT", 300)),
    },
)
logger.info("Cache enabled: %s", cache_enabled)

allowed_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:8000,http://127.0.0.1:8000,http://localhost:8080,http://127.0.0.1:8080",
).split(",")
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type", "X-API-Key", "Authorization"],
        }
    },
)

rate_limit_enabled = os.getenv("RATE_LIMIT_ENABLED", "").lower()
if not rate_limit_enabled:
    # Local dev: no global cap (UI fires many GETs). Production: enable via .env
    rate_limit_enabled = not _is_dev
else:
    rate_limit_enabled = rate_limit_enabled == "true"

_predict_limit = f"{os.getenv('RATE_LIMIT_PREDICT_PER_MINUTE', 30)}/minute"
_compute_limit = f"{os.getenv('RATE_LIMIT_COMPUTE_PER_MINUTE', 20)}/minute"

_limiter_storage = os.getenv("REDIS_URL") or "memory://"

if rate_limit_enabled:
    _general_limit = f"{os.getenv('RATE_LIMIT_PER_MINUTE', 300)}/minute"
    limiter = Limiter(
        app=app,
        key_func=_usage_client_key,
        default_limits=[_general_limit],
        storage_uri=_limiter_storage,
    )
    logger.info(
        "Rate limiting enabled: %s general, %s predict, %s compute",
        _general_limit,
        _predict_limit,
        _compute_limit,
    )
else:
    limiter = Limiter(
        app=app,
        key_func=_usage_client_key,
        default_limits=[],
        storage_uri=_limiter_storage,
    )
    logger.info("Rate limiting disabled (development / RATE_LIMIT_ENABLED=False)")

from backend.observability import init_flask_observability, record_predict  # noqa: E402

init_flask_observability(app)


@app.before_request
def csrf_origin_check():
    """Block cross-origin POST/PUT/DELETE when Origin doesn't match allowed origins."""
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return None
    origin = request.headers.get("Origin") or ""
    referer = request.headers.get("Referer") or ""
    if not origin and not referer:
        return None
    if origin and origin in allowed_origins:
        return None
    if referer:
        from urllib.parse import urlparse
        ref_origin = f"{urlparse(referer).scheme}://{urlparse(referer).netloc}"
        if ref_origin in allowed_origins:
            return None
    logger.warning("CSRF check blocked request from origin=%s referer=%s", origin, referer)
    return jsonify({"error": "Cross-origin request blocked"}), 403


@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
    if not _is_dev:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'"
        )
    return response


def _limit_predict_endpoint(func):
    if limiter and rate_limit_enabled:
        return limiter.limit(_predict_limit)(func)
    return func


def _limit_compute_endpoint(func):
    """Heavy live inference (metrics/curves recompute)."""
    if limiter and rate_limit_enabled:
        return limiter.limit(_compute_limit)(func)
    return func


def _inference_ready() -> bool:
    return model is not None and (
        MODEL_IS_FINETUNED or bool(HUB_MODEL_FALLBACK) or ALLOW_UNTRAINED_BASE
    )


def _inference_status_message() -> str:
    if model is None:
        return "Model is still loading."
    if MODEL_IS_FINETUNED:
        return "Fine-tuned IMDB classifier ready."
    if HUB_MODEL_FALLBACK:
        return f"Inference ready via hub fallback ({MODEL_SOURCE})."
    if ALLOW_UNTRAINED_BASE:
        return "Untrained base model (development only)."
    return (
        "Inference unavailable: train IMDB weights (make train) or set HUB_MODEL_FALLBACK."
    )


def _require_inference_ready():
    if not _inference_ready():
        return (
            jsonify(
                {
                    "error": "Model not ready for inference",
                    "detail": _inference_status_message(),
                    "model_source": MODEL_SOURCE,
                    "inference_ready": False,
                }
            ),
            503,
        )
    return None


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def validate_text_input(text):
    if not isinstance(text, str):
        return ""
    return text[:MAX_TEXT_CHARS].strip()


def log_request(endpoint):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start = time.time()
            client_ip = request.remote_addr
            try:
                result = func(*args, **kwargs)
                logger.info("✅ %s - %s - %.2fs", endpoint, client_ip, time.time() - start)
                return result
            except Exception as exc:
                logger.error(
                    "❌ %s - %s - %.2fs - %s", endpoint, client_ip, time.time() - start, exc
                )
                raise

        return wrapper

    return decorator


def _analyze_aspects_for_text(text: str):
    from backend.services.aspects import sentence_aspects

    return analyze_aspects_ml(text, split_review_sentences, sentence_aspects, predict_sentiment)


def predict_sentiment_detailed(texts, *, language=None):
    """Inference with language routing; returns (preds, prob_pos, prob_neg, lang, lang_conf, source)."""
    single = isinstance(texts, str)
    batch = [texts] if single else list(texts)
    sample = batch[0] if single else " ".join(batch[:2])[:2000]

    lang = language
    lang_conf = 1.0
    if lang is None:
        lang, lang_conf = detect_language(sample)

    source = MODEL_SOURCE
    if needs_multilingual_model(lang) and multilingual_available():
        try:
            preds, prob_pos, prob_neg = predict_multilingual(batch)
            source = f"multilingual:{hub_model_id()}"
            if single:
                return preds, prob_pos, prob_neg, lang, lang_conf, source
            return preds, prob_pos, prob_neg, lang, lang_conf, source
        except Exception as exc:
            logger.warning("Multilingual model failed, using English: %s", exc)

    preds, prob_pos, prob_neg = run_inference(model, tokenizer, batch)
    if single:
        return preds, prob_pos, prob_neg, lang, lang_conf, source
    return preds, prob_pos, prob_neg, lang, lang_conf, source


def predict_sentiment(texts, *, language=None):
    preds, prob_pos, prob_neg, _, _, _ = predict_sentiment_detailed(texts, language=language)
    return preds, prob_pos, prob_neg


def _maybe_dispatch_batch_webhook(results, filename: str = ""):
    key = _get_api_key()
    if not key or not validate_api_key(key):
        return None
    rec = get_key_record(key) or {}
    url = rec.get("webhook_url", "")
    if not url:
        return None
    payload = build_batch_payload(
        "batch.complete",
        results,
        filename=filename,
        model_source=MODEL_SOURCE,
    )
    return dispatch_webhook(url, rec.get("webhook_secret", ""), payload)


_DOCS_DIR = os.path.join(_ROOT, "docs")


@app.route("/api/openapi.yaml", methods=["GET"])
def openapi_yaml():
    """OpenAPI 3 specification."""
    return send_from_directory(_DOCS_DIR, "openapi.yaml", mimetype="text/yaml")


@app.route("/api/docs", methods=["GET"])
def api_docs():
    """Swagger UI — cinema-themed interactive API reference."""
    return redirect("/api-docs.html")


@app.route("/artifacts/results/evaluation.json", methods=["GET"])
def evaluation_artifact_file():
    """Evaluation report for frontend fallback (strict JSON, no Infinity)."""
    artifact = load_evaluation_artifact()
    if not artifact:
        return jsonify({"error": "evaluation.json not found"}), 404
    return jsonify(artifact)


@app.route("/artifacts/results/insights_curves.json", methods=["GET"])
def insights_curves_artifact_file():
    """Precomputed ROC/threshold curves (strict JSON for browser parse)."""
    path = ARTIFACTS_DIR / "insights_curves.json"
    if not path.is_file():
        return jsonify({"error": "insights_curves.json not found. Run: make insights-curves"}), 404
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(sanitize_for_json(data))


@app.route("/artifacts/results/calibration.json", methods=["GET"])
def calibration_artifact_file():
    """Precomputed calibration / reliability diagram data for Insights page."""
    path = ARTIFACTS_DIR / "calibration.json"
    if not path.is_file():
        return jsonify({"error": "calibration.json not found. Run: make insights-curves"}), 404
    return send_from_directory(ARTIFACTS_DIR, "calibration.json", mimetype="application/json")


@app.route("/artifacts/results/dataset_info.json", methods=["GET"])
def dataset_info_artifact_file():
    """Dataset overview snapshot for frontend fallback when API is unavailable."""
    path = ARTIFACTS_DIR / "dataset_info.json"
    if not path.is_file():
        return jsonify({"error": "dataset_info.json not found. Run: make dataset-info"}), 404
    return send_from_directory(ARTIFACTS_DIR, "dataset_info.json", mimetype="application/json")


@app.route("/artifacts/results/error_analysis_test.csv", methods=["GET"])
def error_analysis_csv():
    path = ARTIFACTS_DIR / "error_analysis_test.csv"
    if not path.is_file():
        return jsonify({"error": "error_analysis_test.csv not found. Run: make error-analysis"}), 404
    return send_from_directory(ARTIFACTS_DIR, "error_analysis_test.csv", mimetype="text/csv")


@app.route("/api/model-comparison", methods=["GET"])
@log_request("model-comparison")
def api_model_comparison():
    """DistilBERT vs TF-IDF baseline on val/test (from evaluation artifact)."""
    artifact = load_evaluation_artifact()
    if not artifact:
        return jsonify({"error": "No evaluation artifact. Run: make capstone"}), 503

    split = request.args.get("split", "test").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400

    rows = []
    bert_split = artifact.get("splits", {}).get(split, {})
    bert = bert_split.get("metrics", {})
    if bert:
        rows.append(
            {
                "model": "DistilBERT (fine-tuned)",
                "accuracy": bert.get("accuracy"),
                "f1": bert.get("f1"),
                "precision": bert.get("precision"),
                "recall": bert.get("recall"),
                "roc_auc": bert.get("roc_auc"),
                "average_precision": bert.get("average_precision"),
                "confidence_intervals": bert.get("confidence_intervals"),
            }
        )

    baseline = artifact.get("baselines", {}).get("tfidf_logistic", {})
    bl_split = baseline.get("splits", {}).get(split, {})
    bl_metrics = bl_split.get("metrics", {})
    if bl_metrics:
        rows.append(
            {
                "model": "TF-IDF + Logistic Regression",
                "accuracy": bl_metrics.get("accuracy"),
                "f1": bl_metrics.get("f1"),
                "precision": bl_metrics.get("precision"),
                "recall": bl_metrics.get("recall"),
                "roc_auc": bl_metrics.get("roc_auc"),
                "average_precision": bl_metrics.get("average_precision"),
                "confidence_intervals": bl_metrics.get("confidence_intervals"),
            }
        )

    if len(rows) < 2:
        return (
            jsonify(
                {
                    "error": "Baseline not found. Run: make baseline",
                    "split": split,
                    "models": rows,
                }
            ),
            503,
        )

    deltas = metric_deltas(rows[0], rows[1])

    return jsonify(
        {
            "split": split,
            "models": rows,
            "deltas": deltas,
            "delta_note": "Δ = DistilBERT − TF-IDF (point estimate). Bootstrap CIs are per-model, not paired.",
            "training": artifact.get("training"),
            "methodology": artifact.get("methodology"),
            "data_source": "evaluation_artifact",
        }
    )


def _curves_for_split(split: str, recompute: bool = False, max_rows=None):
    """ROC + threshold curves from artifact or on-the-fly inference (subsample)."""
    artifact = load_evaluation_artifact()
    if not recompute and artifact:
        stored = artifact.get("curves", {}).get(split)
        if stored:
            return stored, "evaluation_artifact", artifact.get("splits", {}).get(split, {}).get("n_samples")

    path = default_val_path() if split == "val" else default_test_path()
    if not path.is_file():
        return None, None, 0

    cap = max_rows if max_rows and max_rows > 0 else (METRICS_MAX_ROWS or None)
    texts, y_true = read_labeled_csv(path, max_rows=cap)
    _, prob_pos, _ = predict_sentiment(texts)
    curves = {
        "threshold_curve": threshold_curve_points(y_true, prob_pos),
        "roc_curve": roc_curve_points(y_true, prob_pos),
        "pr_curve": pr_curve_points(y_true, prob_pos),
        "calibration_curve": calibration_curve_points(y_true, prob_pos),
    }
    return curves, "computed", len(texts)


@app.route("/api/threshold-curve", methods=["GET"])
@_limit_compute_endpoint
@log_request("threshold-curve")
def api_threshold_curve():
    split = request.args.get("split", "val").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400
    recompute = request.args.get("recompute", "false").lower() == "true"
    max_rows = request.args.get("max_rows", type=int) or 1500

    cache_key = f"threshold_curve_{split}_{max_rows}"
    if cache_enabled and not recompute:
        cached = cache.get(cache_key)
        if cached:
            return jsonify(cached)

    curves, source, n = _curves_for_split(split, recompute=recompute, max_rows=max_rows)
    if not curves:
        return jsonify({"error": "Could not compute threshold curve", "split": split}), 503

    payload = {
        "split": split,
        "data_source": source,
        "n_samples": n,
        "points": curves.get("threshold_curve", []),
    }
    if cache_enabled:
        cache.set(cache_key, payload, timeout=3600)
    return jsonify(payload)


@app.route("/api/roc-curve", methods=["GET"])
@_limit_compute_endpoint
@log_request("roc-curve")
def api_roc_curve():
    split = request.args.get("split", "val").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400
    recompute = request.args.get("recompute", "false").lower() == "true"
    max_rows = request.args.get("max_rows", type=int) or 1500

    cache_key = f"roc_curve_{split}_{max_rows}"
    if cache_enabled and not recompute:
        cached = cache.get(cache_key)
        if cached:
            return jsonify(cached)

    curves, source, n = _curves_for_split(split, recompute=recompute, max_rows=max_rows)
    if not curves:
        return jsonify({"error": "Could not compute ROC curve", "split": split}), 503

    roc = curves.get("roc_curve", {})
    payload = {
        "split": split,
        "data_source": source,
        "n_samples": n,
        "fpr": roc.get("fpr", []),
        "tpr": roc.get("tpr", []),
        "auc": roc.get("auc"),
    }
    if cache_enabled:
        cache.set(cache_key, payload, timeout=3600)
    return jsonify(payload)


@app.route("/api/pr-curve", methods=["GET"])
@_limit_compute_endpoint
@log_request("pr-curve")
def api_pr_curve():
    split = request.args.get("split", "val").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400
    recompute = request.args.get("recompute", "false").lower() == "true"
    max_rows = request.args.get("max_rows", type=int) or 1500

    cache_key = f"pr_curve_{split}_{max_rows}"
    if cache_enabled and not recompute:
        cached = cache.get(cache_key)
        if cached:
            return jsonify(cached)

    curves, source, n = _curves_for_split(split, recompute=recompute, max_rows=max_rows)
    if not curves:
        return jsonify({"error": "Could not compute PR curve", "split": split}), 503

    pr = curves.get("pr_curve", {})
    payload = {
        "split": split,
        "data_source": source,
        "n_samples": n,
        "precision": pr.get("precision", []),
        "recall": pr.get("recall", []),
        "average_precision": pr.get("average_precision"),
    }
    if cache_enabled:
        cache.set(cache_key, payload, timeout=3600)
    return jsonify(payload)


@app.route("/api/insights-curves", methods=["GET"])
@_limit_compute_endpoint
@log_request("insights-curves")
def api_insights_curves():
    """All curve data for Insights page in one response (ROC + threshold + PR)."""
    split = request.args.get("split", "val").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400
    recompute = request.args.get("recompute", "false").lower() == "true"
    max_rows = request.args.get("max_rows", type=int) or 1500

    cache_key = f"insights_curves_{split}_{max_rows}"
    if cache_enabled and not recompute:
        cached = cache.get(cache_key)
        if cached:
            return jsonify(cached)

    curves, source, n = _curves_for_split(split, recompute=recompute, max_rows=max_rows)
    if not curves:
        return jsonify({"error": "Could not compute curves", "split": split}), 503

    roc = curves.get("roc_curve", {})
    pr = curves.get("pr_curve", {})
    payload = {
        "split": split,
        "data_source": source,
        "n_samples": n,
        "roc_curve": roc,
        "threshold_curve": curves.get("threshold_curve", []),
        "pr_curve": pr,
        "calibration_curve": curves.get("calibration_curve", {}),
    }
    if cache_enabled:
        cache.set(cache_key, payload, timeout=3600)
    return jsonify(payload)


@app.route("/api/calibration-curve", methods=["GET"])
@_limit_compute_endpoint
@log_request("calibration-curve")
def api_calibration_curve():
    """Reliability diagram data + Brier score and ECE."""
    split = request.args.get("split", "val").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400
    recompute = request.args.get("recompute", "false").lower() == "true"
    max_rows = request.args.get("max_rows", type=int) or 1500

    cache_key = f"calibration_curve_{split}_{max_rows}"
    if cache_enabled and not recompute:
        cached = cache.get(cache_key)
        if cached:
            return jsonify(cached)

    curves, source, n = _curves_for_split(split, recompute=recompute, max_rows=max_rows)
    if not curves:
        return jsonify({"error": "Could not compute calibration curve", "split": split}), 503

    cal = curves.get("calibration_curve", {})
    payload = {
        "split": split,
        "data_source": source,
        "n_samples": n,
        "mean_predicted": cal.get("mean_predicted", []),
        "fraction_positive": cal.get("fraction_positive", []),
        "brier_score": cal.get("brier_score"),
        "ece": cal.get("ece"),
        "n_bins": cal.get("n_bins", 10),
    }
    if cache_enabled:
        cache.set(cache_key, payload, timeout=3600)
    return jsonify(payload)


@app.route("/api/stats-report", methods=["GET"])
@log_request("stats-report")
def api_stats_report():
    """Coursework statistics report (test split primary) from evaluation artifact."""
    artifact = load_evaluation_artifact()
    if not artifact:
        return jsonify({"error": "No evaluation artifact. Run: make evaluate"}), 503
    report = build_stats_report(artifact)
    report["version"] = APP_VERSION
    report["data_source"] = "evaluation_artifact"
    return jsonify(report)


@app.route("/api/capstone-status", methods=["GET"])
@log_request("capstone-status")
def api_capstone_status():
    """Capstone / defense readiness checklist (artifacts + docs)."""
    status = capstone_readiness()
    status["version"] = APP_VERSION
    return jsonify(status)


@app.route("/api/statistical-summary", methods=["GET"])
@log_request("statistical-summary")
def api_statistical_summary():
    """DS summary: derived rates, bootstrap CIs, model deltas, optimal threshold, error meta."""
    split = request.args.get("split", "val").lower()
    if split not in ("val", "test"):
        return jsonify({"error": 'split must be "val" or "test"'}), 400

    artifact = load_evaluation_artifact()
    if not artifact:
        return jsonify({"error": "No evaluation artifact. Run: make evaluate"}), 503

    split_data = artifact.get("splits", {}).get(split)
    if not split_data:
        return jsonify({"error": f"No metrics for split: {split}"}), 404

    metrics = split_data.get("metrics", {})
    cm = metrics.get("confusion_matrix")
    derived = derived_classification_stats(cm) if cm else {}

    curves_block = artifact.get("curves", {}).get(split, {})
    optimal = optimal_threshold_from_curve(curves_block.get("threshold_curve", []))

    comparison_resp = None
    bert_m = metrics
    bl_m = (
        artifact.get("baselines", {})
        .get("tfidf_logistic", {})
        .get("splits", {})
        .get(split, {})
        .get("metrics", {})
    )
    if bl_m:
        comparison_resp = {
            "deltas": metric_deltas(bert_m, bl_m),
            "distilbert_f1": bert_m.get("f1"),
            "baseline_f1": bl_m.get("f1"),
        }

    return jsonify(
        {
            "version": APP_VERSION,
            "split": split,
            "methodology": artifact.get("methodology"),
            "generated_at": artifact.get("generated_at"),
            "n_samples": split_data.get("n_samples") or metrics.get("n_samples"),
            "threshold": metrics.get("threshold", 0.5),
            "metrics": metrics,
            "derived": derived,
            "optimal_threshold": optimal,
            "model_comparison": comparison_resp,
            "error_analysis": artifact.get("error_analysis"),
            "data_source": "evaluation_artifact",
        }
    )


@app.route("/api/error-analysis", methods=["GET"])
@log_request("error-analysis")
def api_error_analysis():
    """Misclassified test reviews as JSON (for in-app error viewer)."""
    csv_path = ARTIFACTS_DIR / "error_analysis_test.csv"
    artifact = load_evaluation_artifact() or {}
    meta = artifact.get("error_analysis", {})

    error_type = request.args.get("error_type", "all").lower()
    limit = request.args.get("limit", type=int) or 200
    limit = max(1, min(limit, 500))

    if not csv_path.is_file():
        return jsonify(
            {
                "error": "error_analysis_test.csv not found",
                "hint": "Run: make error-analysis",
                "summary": meta,
                "rows": [],
            }
        ), 404

    df = pd.read_csv(csv_path)
    if error_type in ("false_positive", "false_negative") and "error_type" in df.columns:
        df = df[df["error_type"] == error_type]

    rows = df.head(limit).to_dict(orient="records")
    fp = int((df["error_type"] == "false_positive").sum()) if "error_type" in df.columns else 0
    fn = int((df["error_type"] == "false_negative").sum()) if "error_type" in df.columns else 0

    summary = dict(meta) if meta else {}
    if not summary.get("n_errors"):
        summary["sample_count"] = len(df)
        summary["n_false_positive"] = fp
        summary["n_false_negative"] = fn

    return jsonify(
        {
            "summary": summary,
            "rows": rows,
            "counts": {
                "false_positive": fp,
                "false_negative": fn,
                "total_exported": len(df),
            },
            "data_source": "error_analysis_test.csv",
        }
    )


@app.route("/api/dashboard-summary", methods=["GET"])
@log_request("dashboard-summary")
def api_dashboard_summary():
    artifact = load_evaluation_artifact()
    summary = {
        "version": APP_VERSION,
        "model_source": MODEL_SOURCE,
        "model_is_finetuned": MODEL_IS_FINETUNED,
        "has_evaluation_artifact": artifact is not None,
        "features": [
            "stats_report_page",
            "stats_report_api",
            "hypothesis_tests_mcnemar_bootstrap",
            "capstone_readiness_api",
            "defense_checklist_page",
            "calibration_reliability_curve",
            "insights_dashboard",
            "roc_threshold_pr_curves",
            "statistical_summary_api",
            "derived_classification_stats",
            "optimal_threshold_f1",
            "model_comparison_deltas",
            "error_analysis_viewer",
            "error_analysis_api",
            "error_analysis_export",
            "bootstrap_ci_metrics",
            "tfidf_baseline",
            "keyboard_shortcuts",
            "demo_review_chips",
            "compare_demo_chips",
            "cinema_unified_theme",
            "val_test_split_selector",
        ],
    }
    if artifact:
        summary["generated_at"] = artifact.get("generated_at")
        summary["metrics_summary"] = artifact.get("summary", {})
        summary["has_baselines"] = "baselines" in artifact
        summary["has_curves"] = bool(artifact.get("curves"))
    return jsonify(summary)


@app.route("/health", methods=["GET"])
def health_check():
    artifact = load_evaluation_artifact()
    ready = _inference_ready()
    return jsonify(
        {
            "status": "healthy",
            "timestamp": time.time(),
            "model_loaded": model is not None,
            "model_is_finetuned": MODEL_IS_FINETUNED,
            "model_source": MODEL_SOURCE,
            "inference_ready": ready,
            "inference_message": _inference_status_message(),
            "has_evaluation_artifact": artifact is not None,
            "version": APP_VERSION,
            "cache_enabled": cache_enabled,
            "rate_limit_enabled": rate_limit_enabled,
        }
    ), 200


@app.route("/health/ready", methods=["GET"])
def health_ready():
    """Readiness: process can serve inference (for load balancers / k8s)."""
    artifact = load_evaluation_artifact()
    ready = _inference_ready()
    body = {
        "status": "ready" if ready else "not_ready",
        "timestamp": time.time(),
        "model_loaded": model is not None,
        "model_is_finetuned": MODEL_IS_FINETUNED,
        "model_source": MODEL_SOURCE,
        "inference_ready": ready,
        "inference_message": _inference_status_message(),
        "has_evaluation_artifact": artifact is not None,
        "version": APP_VERSION,
    }
    return jsonify(body), 200 if ready else 503


@app.route("/api/usage", methods=["GET"])
@log_request("usage")
def api_usage():
    """Usage summary for product UI (per IP or API key per day)."""
    count = _get_api_usage()
    limit = _client_daily_limit()
    key = _get_api_key()
    tier = key_tier(key) if key and validate_api_key(key) else "free"
    return jsonify(
        {
            "date": _usage_day_key(),
            "count": count,
            "daily_limit": limit,
            "remaining": max(0, limit - count),
            "tier": tier,
            "api_key_valid": bool(key and validate_api_key(key)),
            "upgrade_url": "/developer.html",
        }
    )


@app.route("/api/developer/me", methods=["GET"])
@log_request("developer_me")
def api_developer_me():
    """Validate API key and return tier + usage (Pro / developer portal)."""
    key = _get_api_key()
    if not key:
        return jsonify({"error": "X-API-Key or Authorization: Bearer required"}), 401
    info = developer_info(key)
    if not info["valid"]:
        return jsonify({"error": "Invalid API key"}), 403
    count = _get_api_usage()
    limit = daily_limit_for_tier(info["tier"])
    info["usage"] = {
        "date": _usage_day_key(),
        "count": count,
        "daily_limit": limit,
        "remaining": max(0, limit - count),
    }
    return jsonify(info)


@app.route("/api/developer/webhook", methods=["PUT", "POST"])
@log_request("developer_webhook")
def api_developer_webhook():
    """Configure outbound webhook URL for batch completion (Pro API keys)."""
    key = _get_api_key()
    if not key or not validate_api_key(key):
        return jsonify({"error": "Valid X-API-Key required"}), 401
    data = request.get_json() or {}
    url = (data.get("webhook_url") or "").strip()
    secret = data.get("webhook_secret")
    if not url:
        return jsonify({"error": "webhook_url required"}), 400
    from backend.services.api_keys import register_key

    if get_key_record(key) is None:
        register_key(key, tier=key_tier(key), webhook_url=url, webhook_secret=secret or "")
    else:
        update_key_webhook(key, url, secret)
    return jsonify({"ok": True, "webhook_url": url[:64] + ("…" if len(url) > 64 else "")})


@app.route("/api/webhooks/test", methods=["POST"])
@log_request("webhook_test")
def api_webhook_test():
    """Send a test payload to the configured webhook."""
    key = _get_api_key()
    if not key or not validate_api_key(key):
        return jsonify({"error": "Valid X-API-Key required"}), 401
    rec = get_key_record(key) or {}
    url = rec.get("webhook_url", "")
    if not url:
        return jsonify({"error": "Configure webhook_url first via PUT /api/developer/webhook"}), 400
    payload = build_batch_payload(
        "webhook.test",
        [{"text": "Test review — stunning visuals.", "label": 1, "confidence": 0.91}],
        filename="test.csv",
        model_source=MODEL_SOURCE,
        total=1,
    )
    result = dispatch_webhook(url, rec.get("webhook_secret", ""), payload)
    status = 200 if result.get("ok") else 502
    return jsonify(result), status


@app.route("/api/billing/checkout", methods=["POST"])
@log_request("billing_checkout")
def api_billing_checkout():
    """Create Stripe Checkout session or issue demo Pro key."""
    data = request.get_json() or {}
    email = data.get("email", "")
    result = create_checkout_session(email)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@app.route("/api/billing/webhook", methods=["POST"])
def api_billing_stripe_webhook():
    """Stripe webhook — provisions Pro API keys on successful checkout."""
    payload = request.get_data()
    sig = request.headers.get("Stripe-Signature", "")
    result = handle_stripe_webhook(payload, sig)
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@app.route("/api/billing/status", methods=["GET"])
def api_billing_status():
    return jsonify({"stripe_enabled": stripe_enabled(), "upgrade_url": "/developer.html"})


@app.route("/api/predict", methods=["POST"])
@_limit_predict_endpoint
@log_request("predict")
def api_predict():
    blocked = _require_inference_ready()
    if blocked:
        return blocked

    try:
        if request.content_type and request.content_type.startswith("multipart/form-data"):
            file = request.files.get("file")
            if not file:
                return jsonify({"error": "No file uploaded"}), 400
            if not allowed_file(file.filename):
                return jsonify(
                    {"error": f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}
                ), 400

            filename = secure_filename(file.filename)
            logger.info("Processing batch file: %s", filename)
            results = []
            for chunk in pd.read_csv(file, chunksize=500):
                if "text" not in chunk.columns:
                    return jsonify({"error": 'CSV must contain a "text" column'}), 400
                texts = [validate_text_input(t) for t in chunk["text"].astype(str).tolist()]
                preds, prob_pos, prob_neg = predict_sentiment(texts)
                for t, label, pp, pn in zip(texts, preds, prob_pos, prob_neg):
                    row = format_single_prediction(int(label), float(pp), float(pn))
                    row["text"] = t
                    results.append(row)
            _record_api_usage(len(results))
            wh = _maybe_dispatch_batch_webhook(results, filename=filename)
            body = {"results": results, "model_source": MODEL_SOURCE}
            if wh:
                body["webhook"] = wh
            return jsonify(body)

        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400
        preds, prob_pos, prob_neg, lang, lang_conf, src = predict_sentiment_detailed(
            text, language=data.get("language")
        )
        out = format_single_prediction(int(preds[0]), float(prob_pos[0]), float(prob_neg[0]))
        out["model_source"] = src
        out["language"] = lang
        out["language_confidence"] = round(lang_conf, 3)
        _record_api_usage(1)
        record_predict("predict")
        return jsonify(out)
    except pd.errors.EmptyDataError:
        return jsonify({"error": "CSV file is empty"}), 400
    except Exception as exc:
        logger.error("predict error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/sample.csv")
def api_sample_csv():
    """Downloadable labeled sample for dataset / EDA page."""
    path = Path(__file__).resolve().parent.parent / "data" / "samples" / "train_small.csv"
    if not path.is_file():
        return jsonify({"error": "Sample file not found"}), 404
    return send_from_directory(
        path.parent,
        path.name,
        mimetype="text/csv",
        as_attachment=True,
        download_name="cinesentiment_sample_reviews.csv",
    )


@app.route("/api/sample-batch.csv")
def api_sample_batch_csv():
    """Demo CSV for batch upload (text column only)."""
    path = Path(__file__).resolve().parent.parent / "frontend" / "data" / "sample-batch.csv"
    if not path.is_file():
        return jsonify({"error": "Batch sample not found"}), 404
    return send_from_directory(
        path.parent,
        path.name,
        mimetype="text/csv",
        as_attachment=True,
        download_name="cinesentiment_batch_sample.csv",
    )


@app.route("/api/analyze", methods=["POST"])
@_limit_predict_endpoint
@log_request("analyze")
def api_analyze():
    """Full analysis: prediction + optional explainability + sentence-level arc."""
    blocked = _require_inference_ready()
    if blocked:
        return blocked
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400

        include_explain = data.get("explain", True)
        include_arc = data.get("arc", True)
        include_aspects = data.get("aspects", True)

        preds, prob_pos, prob_neg, lang, lang_conf, src = predict_sentiment_detailed(
            text, language=data.get("language")
        )
        out = format_single_prediction(int(preds[0]), float(prob_pos[0]), float(prob_neg[0]))
        out["model_source"] = src
        out["language"] = lang
        out["language_confidence"] = round(lang_conf, 3)

        conf = out["confidence"]
        if 0.45 <= conf <= 0.55:
            out["uncertainty"] = {
                "level": "borderline",
                "message": "Model confidence is near the decision boundary — treat as advisory.",
            }

        if include_explain:
            out["explanation"] = explain_input_gradient(model, tokenizer, text)

        if include_arc:
            sentences = split_review_sentences(text)
            if len(sentences) >= 2:
                arc_preds, arc_pos, arc_neg = predict_sentiment(sentences)
                arc = []
                for sent, label, pp, pn in zip(sentences, arc_preds, arc_pos, arc_neg):
                    row = format_single_prediction(int(label), float(pp), float(pn))
                    row["text"] = sent
                    arc.append(row)
                out["arc"] = arc
                fresh = sum(1 for a in arc if a["label"] == 1)
                out["arc_summary"] = {
                    "sentences": len(arc),
                    "fresh_count": fresh,
                    "rotten_count": len(arc) - fresh,
                    "tone_shift": arc[0]["label"] != arc[-1]["label"],
                }
            else:
                out["arc"] = []
                out["arc_summary"] = {"sentences": len(sentences), "note": "Add 2+ sentences for tone arc."}

        if include_aspects:
            out["aspects"] = _analyze_aspects_for_text(text)

        _record_api_usage(1)
        return jsonify(out)
    except Exception as exc:
        logger.error("analyze error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/aspects", methods=["POST"])
@_limit_predict_endpoint
@log_request("aspects")
def api_aspects():
    """Aspect-based sentiment (acting, plot, visuals, pacing, sound)."""
    blocked = _require_inference_ready()
    if blocked:
        return blocked
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400
        result = _analyze_aspects_for_text(text)
        _record_api_usage(1)
        return jsonify(result)
    except Exception as exc:
        logger.error("aspects error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/rag/query", methods=["POST"])
@log_request("rag_query")
def api_rag_query():
    """Semantic search over indexed reviews (Chroma + embeddings)."""
    try:
        from backend.services.rag import query_similar, rag_enabled

        if not rag_enabled():
            return jsonify({"error": "RAG disabled"}), 503
        data = request.get_json() or {}
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400
        k = min(int(data.get("k", 5)), 20)
        return jsonify(query_similar(text, k=k))
    except ImportError:
        return jsonify({"error": "RAG dependencies not installed (chromadb, sentence-transformers)"}), 503
    except Exception as exc:
        logger.error("rag query error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/agent/analyze", methods=["POST"])
@_limit_predict_endpoint
@log_request("agent_analyze")
def api_agent_analyze():
    """LangGraph multi-step agent: validate → predict → RAG → summarize."""
    blocked = _require_inference_ready()
    if blocked:
        return blocked
    try:
        from backend.services.agent_graph import agent_enabled, run_sentiment_agent

        if not agent_enabled():
            return jsonify({"error": "Agent disabled (AGENT_ENABLED=false)"}), 503
        data = request.get_json() or {}
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400
        result = run_sentiment_agent(text)
        if result.get("error"):
            return jsonify(result), 400
        _record_api_usage(1)
        return jsonify(result)
    except ImportError as exc:
        return jsonify({"error": f"LangGraph not installed: {exc}"}), 503
    except Exception as exc:
        logger.error("agent analyze error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/features", methods=["POST"])
@log_request("features")
def api_features():
    """Online feature store lookup (Feast or inline fallback)."""
    try:
        from backend.services.feature_store import get_review_features

        data = request.get_json() or {}
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400
        return jsonify(get_review_features(text, review_id=data.get("review_id")))
    except Exception as exc:
        logger.error("features error: %s", exc)
        return jsonify({"error": str(exc)}), 500


@app.route("/api/inference/backend", methods=["GET"])
@log_request("inference_backend")
def api_inference_backend():
    """Report active inference backend (local | vllm | triton)."""
    from backend.services.remote_inference import backend_info

    return jsonify(backend_info())


@app.route("/api/rag/stats", methods=["GET"])
@log_request("rag_stats")
def api_rag_stats():
    try:
        from backend.services.rag import collection_stats, rag_enabled

        if not rag_enabled():
            return jsonify({"enabled": False})
        return jsonify({"enabled": True, **collection_stats()})
    except ImportError:
        return jsonify({"enabled": True, "count": 0, "message": "Install chromadb + sentence-transformers"})


@app.route("/api/predict/stream", methods=["POST"])
@_limit_predict_endpoint
@log_request("predict_stream")
def api_predict_stream():
    """SSE stream for batch CSV — progress events then final results."""
    blocked = _require_inference_ready()
    if blocked:
        return blocked

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

    raw = file.read()
    if len(raw) > MAX_FILE_SIZE:
        return jsonify({"error": "File too large"}), 413

    def generate():
        yield f"data: {json.dumps({'type': 'started', 'filename': secure_filename(file.filename)})}\n\n"
        results = []
        done = 0
        try:
            buf = StringIO(raw.decode("utf-8", errors="replace"))
            for chunk in pd.read_csv(buf, chunksize=50):
                if "text" not in chunk.columns:
                    yield f"data: {json.dumps({'type': 'error', 'error': 'CSV must contain a text column'})}\n\n"
                    return
                texts = [validate_text_input(t) for t in chunk["text"].astype(str).tolist()]
                preds, prob_pos, prob_neg = predict_sentiment(texts)
                batch_rows = []
                for t, label, pp, pn in zip(texts, preds, prob_pos, prob_neg):
                    row = format_single_prediction(int(label), float(pp), float(pn))
                    row["text"] = t
                    batch_rows.append(row)
                results.extend(batch_rows)
                done += len(batch_rows)
                yield f"data: {json.dumps({'type': 'progress', 'done': done, 'batch_size': len(batch_rows)})}\n\n"
            _record_api_usage(len(results))
            wh = _maybe_dispatch_batch_webhook(results, filename=secure_filename(file.filename))
            complete = {
                "type": "complete",
                "total": len(results),
                "results": results,
                "model_source": MODEL_SOURCE,
            }
            if wh:
                complete["webhook"] = wh
            yield f"data: {json.dumps(complete)}\n\n"
        except pd.errors.EmptyDataError:
            yield f"data: {json.dumps({'type': 'error', 'error': 'CSV file is empty'})}\n\n"
        except Exception as exc:
            logger.error("predict stream error: %s", exc)
            yield f"data: {json.dumps({'type': 'error', 'error': 'Internal server error'})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/api/explain", methods=["POST"])
@_limit_predict_endpoint
@log_request("explain")
def api_explain():
    """Token-level importance via input-x-gradient (model-derived, not lexicon)."""
    blocked = _require_inference_ready()
    if blocked:
        return blocked
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        text = validate_text_input(data.get("text", ""))
        if not text:
            return jsonify({"error": "Text is required"}), 400

        return jsonify(explain_input_gradient(model, tokenizer, text))
    except Exception as exc:
        logger.error("Explain error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/metrics", methods=["GET"])
@log_request("metrics")
def api_metrics():
    try:
        threshold = float(request.args.get("threshold", 0.5))
        if not 0.0 <= threshold <= 1.0:
            return jsonify({"error": "Threshold must be between 0.0 and 1.0"}), 400

        split = request.args.get("split", "val").lower()
        if split not in ("val", "test"):
            return jsonify({"error": 'split must be "val" or "test"'}), 400

        recompute = request.args.get("recompute", "false").lower() == "true"

        cache_key = f"metrics_{split}_{threshold}"
        if cache_enabled and not recompute:
            cached = cache.get(cache_key)
            if cached:
                return jsonify(cached)

        # Default: serve precomputed evaluation.json (instant). Avoid silent full-split inference.
        if not recompute:
            artifact = load_evaluation_artifact()
            if artifact and split in artifact.get("splits", {}):
                split_data = artifact["splits"][split]
                result = {**split_data.get("metrics", {}), **split_data}
                result["data_source"] = "evaluation_artifact"
                result["model_source"] = artifact.get("model_source", MODEL_SOURCE)
                if threshold != split_data.get("threshold", 0.5):
                    result["threshold_note"] = (
                        "Saved metrics used threshold "
                        f"{split_data.get('threshold', 0.5)}. "
                        "Move the slider and release to recompute at a new threshold."
                    )
                if cache_enabled:
                    cache.set(cache_key, result, timeout=600)
                return jsonify(result)
            return (
                jsonify(
                    {
                        "error": "No evaluation artifact found.",
                        "hint": "Run: make evaluate  (or make train-fast && make evaluate)",
                    }
                ),
                503,
            )

        path = default_val_path() if split == "val" else default_test_path()
        if not path.is_file():
            return jsonify({"error": f"Dataset not found: {path}", "split": split}), 404

        max_rows_arg = request.args.get("max_rows", type=int)
        if max_rows_arg is not None and max_rows_arg > 0:
            max_rows = max_rows_arg
        else:
            max_rows = METRICS_MAX_ROWS if METRICS_MAX_ROWS > 0 else None
        texts, y_true = read_labeled_csv(path, max_rows=max_rows)
        _, prob_pos, _ = predict_sentiment(texts)

        metrics = compute_classification_metrics(y_true, prob_pos, threshold)
        metrics["confidence_intervals"] = bootstrap_metric_cis(
            y_true, prob_pos, threshold, n_bootstrap=BOOTSTRAP_SAMPLES
        )
        metrics["split"] = split
        metrics["dataset_path"] = str(path)
        metrics["data_source"] = "computed"
        metrics["model_source"] = MODEL_SOURCE
        metrics["note"] = (
            "probability column in predict API is P(positive). "
            "Threshold applied to P(positive) for binary decision."
        )

        if cache_enabled:
            cache.set(cache_key, metrics, timeout=600)
        return jsonify(metrics)
    except ValueError:
        return jsonify({"error": "Invalid threshold value"}), 400
    except Exception as exc:
        logger.error("metrics error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/dataset-info", methods=["GET"])
@log_request("dataset-info")
def api_dataset_info():
    try:
        cache_key = "dataset_info_v2"
        if cache_enabled:
            cached = cache.get(cache_key)
            if cached:
                return jsonify(cached)

        train_path = default_train_path()
        val_path = default_val_path()
        test_path = default_test_path()

        for p in (train_path, val_path, test_path):
            if p == train_path and not p.is_file():
                return jsonify({"error": f"Training data not found: {p}"}), 404

        result = dataset_summary(train_path, val_path, test_path)
        result["paths"] = {
            "train": str(train_path),
            "val": str(val_path),
            "test": str(test_path),
        }

        if cache_enabled:
            cache.set(cache_key, result, timeout=3600)
        return jsonify(result)
    except Exception as exc:
        logger.error("dataset-info error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/model-info", methods=["GET"])
@log_request("model_info")
def api_model_info():
    try:
        artifact = load_evaluation_artifact()
        result = {
            "model": {
                "model_name": MODEL_NAME,
                "model_type": getattr(model.config, "model_type", "unknown"),
                "num_labels": getattr(model.config, "num_labels", 2),
                "vocab_size": getattr(tokenizer, "vocab_size", None),
                "max_length": getattr(tokenizer, "model_max_length", 512),
                "model_parameters": sum(p.numel() for p in model.parameters()),
                "device": "cuda" if torch.cuda.is_available() else "cpu",
            },
            "training": {
                "model_dir": MODEL_DIR,
                "has_trained_weights": has_trained_weights(MODEL_DIR),
                "is_finetuned": MODEL_IS_FINETUNED,
                "model_source": MODEL_SOURCE,
                "training_status": "finetuned" if MODEL_IS_FINETUNED else "not_finetuned",
            },
            "evaluation_artifact": {
                "path": str(ARTIFACTS_DIR / "evaluation.json"),
                "exists": artifact is not None,
                "summary": artifact.get("summary") if artifact else None,
            },
            "system": {
                "python_version": sys.version.split()[0],
                "torch_version": torch.__version__,
                "cuda_available": torch.cuda.is_available(),
                "timestamp": time.time(),
            },
            "status": "operational",
        }
        return jsonify(result), 200
    except Exception as exc:
        logger.error("model_info error: %s", exc)
        return jsonify({"error": "Failed to retrieve model information"}), 500


@app.route("/api/predict/confidence", methods=["POST"])
@_limit_predict_endpoint
@log_request("predict_confidence")
def api_predict_with_confidence():
    blocked = _require_inference_ready()
    if blocked:
        return blocked

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON"}), 400
        text = validate_text_input(data.get("text", ""))
        min_confidence = float(data.get("min_confidence", 0.5))
        if not text:
            return jsonify({"error": "Text is required"}), 400
        if not 0.0 <= min_confidence <= 1.0:
            return jsonify({"error": "Minimum confidence must be between 0.0 and 1.0"}), 400

        preds, prob_pos, prob_neg = predict_sentiment(text)
        out = format_single_prediction(int(preds[0]), float(prob_pos[0]), float(prob_neg[0]))
        meets = out["confidence"] >= min_confidence
        out["meets_threshold"] = meets
        out["min_confidence_required"] = min_confidence
        out["model_source"] = MODEL_SOURCE
        if meets:
            return jsonify(out), 200
        out["warning"] = "Prediction confidence below threshold"
        return jsonify(out), 206
    except ValueError as exc:
        return jsonify({"error": f"Invalid parameter: {exc}"}), 400
    except Exception as exc:
        logger.error("predict_confidence error: %s", exc)
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/predict/batch/export", methods=["POST"])
@_limit_predict_endpoint
@log_request("batch_export")
def api_batch_export():
    blocked = _require_inference_ready()
    if blocked:
        return blocked

    try:
        file = request.files.get("file")
        if not file:
            return jsonify({"error": "No file uploaded"}), 400
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type"}), 400

        results = []
        for chunk in pd.read_csv(file, chunksize=500):
            if "text" not in chunk.columns:
                return jsonify({"error": 'CSV must contain a "text" column'}), 400
            texts = [validate_text_input(t) for t in chunk["text"].astype(str).tolist()]
            preds, prob_pos, prob_neg = predict_sentiment(texts)
            for i, (t, label, pp, pn) in enumerate(zip(texts, preds, prob_pos, prob_neg)):
                results.append(
                    {
                        "text": t,
                        "predicted_label": int(label),
                        "sentiment": "positive" if int(label) == 1 else "negative",
                        "confidence": float(pp if label == 1 else pn),
                        "probability_positive": float(pp),
                        "original_label": chunk.iloc[i].get("label", "N/A")
                        if "label" in chunk.columns
                        else "N/A",
                    }
                )

        output = StringIO()
        pd.DataFrame(results).to_csv(output, index=False)
        output.seek(0)
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=predictions.csv"},
        )
    except Exception as exc:
        logger.error("batch_export error: %s", exc)
        return jsonify({"error": "Failed to export batch predictions"}), 500


# Friendly URLs without .html (must match layout.js nav targets)
_PAGE_SHORTCUTS = {
    "home": "index.html",
    "analyze": "batch.html",
    "batch": "batch.html",
    "compare": "compare.html",
    "evaluation": "evaluation.html",
    "metrics": "evaluation.html",
    "dataset": "dataset.html",
    "insights": "insights.html",
    "summary": "summary.html",
    "stats": "summary.html",
    "report": "summary.html",
}


def _wants_html():
    best = request.accept_mimetypes.best_match(["text/html", "application/json"])
    return best == "text/html" or (
        request.accept_mimetypes[best] > request.accept_mimetypes["application/json"]
        if best
        else False
    )


def _send_html_404():
    try:
        return send_from_directory(app.static_folder, "404.html"), 404
    except Exception:
        return (
            "<!DOCTYPE html><html><body><h1>404</h1>"
            '<p><a href="/">Home</a></p></body></html>',
            404,
            {"Content-Type": "text/html; charset=utf-8"},
        )


_MODERN_DIST = Path(__file__).resolve().parent.parent / "frontend-react" / "dist"


@app.route("/modern")
@app.route("/modern/")
@app.route("/modern/<path:subpath>")
def serve_modern_ui(subpath=""):
    """React + TypeScript SPA (v2.2) — build with: make frontend-react-build"""
    if not _MODERN_DIST.is_dir():
        return jsonify(
            {
                "error": "Modern UI not built",
                "hint": "Run: cd frontend-react && npm install && npm run build",
            }
        ), 404
    if subpath and (_MODERN_DIST / subpath).is_file():
        return send_from_directory(_MODERN_DIST, subpath)
    return send_from_directory(_MODERN_DIST, "index.html")


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def serve_frontend(path):
    if ".." in path:
        return _send_html_404() if _wants_html() else (jsonify({"error": "File not found"}), 404)

    # Never treat /api/* as a static file (avoids HTML 404 when an API route is missing)
    if path.startswith("api/"):
        return jsonify(
            {
                "error": "API endpoint not found",
                "path": "/" + path,
                "hint": "Restart the server (make serve). v2.0 adds /api/developer/me, /api/billing/checkout, /api/aspects.",
            }
        ), 404

    # Normalize: /index.html/ -> /index.html
    if path.endswith("/") and path != "/":
        return redirect("/" + path.rstrip("/"), code=301)

    shortcut = _PAGE_SHORTCUTS.get(path.lower().rstrip("/"))
    if shortcut:
        path = shortcut

    # Only serve known static extensions or HTML pages
    allowed_suffixes = (
        ".html",
        ".css",
        ".js",
        ".svg",
        ".png",
        ".jpg",
        ".jpeg",
        ".ico",
        ".woff",
        ".woff2",
        ".map",
        ".json",
        ".csv",
    )
    if "." in path.split("/")[-1] and not path.lower().endswith(allowed_suffixes):
        return _send_html_404() if _wants_html() else (jsonify({"error": "File not found"}), 404)

    try:
        return send_from_directory(app.static_folder, path)
    except Exception:
        return _send_html_404() if _wants_html() else (jsonify({"error": "File not found"}), 404)


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Resource not found"}), 404
    if _wants_html():
        return _send_html_404()
    return jsonify({"error": "Resource not found"}), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error("Internal server error: %s", error)
    return jsonify({"error": "Internal server error"}), 500


@app.errorhandler(413)
def request_entity_too_large(_error):
    return jsonify({"error": f"File too large. Maximum: {MAX_FILE_SIZE // (1024 * 1024)}MB"}), 413


if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")  # nosec B104
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "False").lower() == "true"
    if _flask_env == "production":
        if debug:
            logger.warning("DEBUG=true ignored when FLASK_ENV=production")
        debug = False
    logger.info("Starting Flask on %s:%s (debug=%s)", host, port, debug)
    app.run(host=host, port=port, debug=debug)
