"""LangGraph orchestration — multi-step sentiment analysis agent."""
from __future__ import annotations

import os
from typing import Any, TypedDict

_graph = None


class AgentState(TypedDict, total=False):
    text: str
    label: int
    sentiment: str
    confidence: float
    probability_positive: float
    similar_reviews: list
    summary: str
    steps: list[str]
    error: str


def agent_enabled() -> bool:
    return os.getenv("AGENT_ENABLED", "true").lower() in ("1", "true", "yes")


def _node_validate(state: AgentState) -> AgentState:
    text = (state.get("text") or "").strip()
    steps = list(state.get("steps") or [])
    if not text:
        return {**state, "error": "empty text", "steps": steps + ["validate:fail"]}
    return {**state, "text": text, "steps": steps + ["validate:ok"]}


def _node_predict(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
    from backend.model_loader import get_inference_bundle
    from backend.services.inference import predict_with_backend

    bundle = get_inference_bundle()
    labels, prob_pos, _ = predict_with_backend(bundle.model, bundle.tokenizer, state["text"])
    label = int(labels[0])
    p = float(prob_pos[0])
    sentiment = "positive" if label == 1 else "negative"
    steps = list(state.get("steps") or [])
    return {
        **state,
        "label": label,
        "sentiment": sentiment,
        "confidence": max(p, 1 - p),
        "probability_positive": p,
        "steps": steps + ["predict:ok"],
    }


def _node_rag(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
    matches: list = []
    steps = list(state.get("steps") or [])
    try:
        from backend.services.rag import query_similar, rag_enabled

        if rag_enabled():
            matches = query_similar(state["text"], k=3).get("matches", [])
    except Exception:
        pass
    return {**state, "similar_reviews": matches, "steps": steps + ["rag:ok"]}


def _node_summarize(state: AgentState) -> AgentState:
    if state.get("error"):
        return state
    n = len(state.get("similar_reviews") or [])
    steps = list(state.get("steps") or [])
    summary = (
        f"Sentiment: {state['sentiment']} ({state['confidence']:.0%} confidence). "
        f"Found {n} similar review(s) in corpus."
    )
    return {**state, "summary": summary, "steps": steps + ["summarize:ok"]}


def _get_graph():
    global _graph
    if _graph is not None:
        return _graph
    from langgraph.graph import END, StateGraph

    g = StateGraph(AgentState)
    g.add_node("validate", _node_validate)
    g.add_node("predict", _node_predict)
    g.add_node("rag", _node_rag)
    g.add_node("summarize", _node_summarize)
    g.set_entry_point("validate")
    g.add_edge("validate", "predict")
    g.add_edge("predict", "rag")
    g.add_edge("rag", "summarize")
    g.add_edge("summarize", END)
    _graph = g.compile()
    return _graph


def run_sentiment_agent(text: str) -> dict[str, Any]:
    """Execute LangGraph pipeline: validate → predict → RAG → summarize."""
    result = _get_graph().invoke({"text": text, "steps": []})
    if result.get("error"):
        return {"error": result["error"], "steps": result.get("steps", []), "orchestrator": "langgraph"}
    return {
        "text": result["text"],
        "label": result["label"],
        "sentiment": result["sentiment"],
        "confidence": result["confidence"],
        "probability_positive": result["probability_positive"],
        "similar_reviews": result.get("similar_reviews", []),
        "summary": result.get("summary", ""),
        "steps": result.get("steps", []),
        "orchestrator": "langgraph",
    }
