"""
FastAPI v2 service — modern async API parallel to Flask (port 8001).
Run: make serve-fastapi  or  uvicorn backend.fastapi_app:app --host 0.0.0.0 --port 8001
"""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.model_loader import get_inference_bundle
from backend.services.inference import predict_sentiment, predict_with_backend
from backend.services.rag import collection_stats, query_similar, rag_enabled

VERSION_FILE = Path(__file__).resolve().parent.parent / "VERSION"
APP_VERSION = VERSION_FILE.read_text().strip() if VERSION_FILE.is_file() else "2.1.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_inference_bundle()
    yield


app = FastAPI(
    title="CineSentiment API v2",
    version=APP_VERSION,
    description="FastAPI surface: predict, analyze-lite, RAG. Flask remains on :8000.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


class PredictResponse(BaseModel):
    label: int
    sentiment: str
    confidence: float
    probability_positive: float
    model_source: str
    api: str = "fastapi-v2"


class RagQueryRequest(BaseModel):
    text: str = Field(..., min_length=1)
    k: int = Field(5, ge=1, le=20)


@app.get("/health")
def health():
    bundle = get_inference_bundle()
    return {
        "status": "healthy",
        "version": APP_VERSION,
        "runtime": "fastapi",
        "model_source": bundle.model_source,
        "model_is_finetuned": bundle.model_is_finetuned,
        "rag_enabled": rag_enabled(),
    }


@app.get("/health/ready")
def health_ready():
    bundle = get_inference_bundle()
    return {
        "status": "ready",
        "model_source": bundle.model_source,
        "inference_ready": True,
        "version": APP_VERSION,
    }


@app.post("/api/v2/predict", response_model=PredictResponse)
def predict_v2(body: PredictRequest):
    bundle = get_inference_bundle()
    labels, prob_pos, _ = predict_with_backend(bundle.model, bundle.tokenizer, body.text)
    label = int(labels[0])
    p = float(prob_pos[0])
    return PredictResponse(
        label=label,
        sentiment="positive" if label == 1 else "negative",
        confidence=max(p, 1 - p),
        probability_positive=p,
        model_source=bundle.model_source,
    )


@app.post("/api/v2/analyze")
def analyze_v2(body: PredictRequest):
    bundle = get_inference_bundle()
    labels, prob_pos, _ = predict_with_backend(bundle.model, bundle.tokenizer, body.text)
    label = int(labels[0])
    p = float(prob_pos[0])
    rag_ctx: dict[str, Any] = {}
    if rag_enabled():
        try:
            rag_ctx = query_similar(body.text, k=3)
        except Exception as exc:
            rag_ctx = {"error": str(exc)}
    return {
        "label": label,
        "sentiment": "positive" if label == 1 else "negative",
        "confidence": max(p, 1 - p),
        "probability_positive": p,
        "model_source": bundle.model_source,
        "similar_reviews": rag_ctx.get("matches", []),
        "api": "fastapi-v2",
        "timestamp": time.time(),
    }


@app.post("/api/v2/rag/query")
def rag_query(body: RagQueryRequest):
    if not rag_enabled():
        raise HTTPException(503, "RAG disabled (RAG_ENABLED=false)")
    try:
        return query_similar(body.text, k=body.k)
    except ImportError as exc:
        raise HTTPException(503, f"RAG dependencies missing: {exc}") from exc


@app.get("/api/v2/rag/stats")
def rag_stats():
    if not rag_enabled():
        return {"enabled": False}
    try:
        return {"enabled": True, **collection_stats()}
    except ImportError:
        return {"enabled": True, "count": 0, "message": "Install chromadb + sentence-transformers"}


class AgentRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)


@app.post("/api/v2/agent/analyze")
def agent_analyze_v2(body: AgentRequest):
    from backend.services.agent_graph import agent_enabled, run_sentiment_agent

    if not agent_enabled():
        raise HTTPException(503, "Agent disabled")
    result = run_sentiment_agent(body.text)
    if result.get("error"):
        raise HTTPException(400, result["error"])
    return {**result, "api": "fastapi-v2"}


@app.get("/api/v2/inference/backend")
def inference_backend_v2():
    from backend.services.remote_inference import backend_info

    return backend_info()


@app.get("/metrics")
def metrics():
    try:
        from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
        from fastapi import Response

        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)
    except ImportError:
        raise HTTPException(501, "prometheus_client not installed")
