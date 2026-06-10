"""Remote inference backends — vLLM (OpenAI-compatible) and NVIDIA Triton."""
from __future__ import annotations

import json
import os
from typing import Sequence, Tuple, Union

import numpy as np


def inference_backend() -> str:
    return os.getenv("INFERENCE_BACKEND", "local").lower()


def backend_info() -> dict:
    return {
        "backend": inference_backend(),
        "vllm_base_url": os.getenv("VLLM_BASE_URL", "http://127.0.0.1:8002/v1"),
        "triton_url": os.getenv("TRITON_URL", "http://127.0.0.1:8003"),
        "triton_model": os.getenv("TRITON_MODEL", "distilbert_sentiment"),
    }


def try_remote_predict(
    texts: Union[str, Sequence[str]],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    """Return predictions from remote backend, or None to use local HF model."""
    if isinstance(texts, str):
        texts = [texts]
    backend = inference_backend()
    if backend == "local":
        return None
    if backend == "vllm":
        return _predict_vllm(list(texts))
    if backend == "triton":
        return _predict_triton(list(texts))
    raise ValueError(f"Unknown INFERENCE_BACKEND={backend!r} (use local|vllm|triton)")


def _predict_vllm(texts: list[str]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """vLLM OpenAI-compatible chat completions for zero-shot classification."""
    from openai import OpenAI

    base = os.getenv("VLLM_BASE_URL", "http://127.0.0.1:8002/v1")
    model = os.getenv("VLLM_MODEL", "meta-llama/Llama-3.2-1B-Instruct")
    client = OpenAI(base_url=base, api_key=os.getenv("VLLM_API_KEY", "EMPTY"))
    labels: list[int] = []
    prob_pos: list[float] = []
    prob_neg: list[float] = []
    for text in texts:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "Reply POSITIVE or NEGATIVE for movie review sentiment.",
                },
                {"role": "user", "content": text[:3000]},
            ],
            temperature=0,
            max_tokens=8,
        )
        label_txt = (resp.choices[0].message.content or "").strip().upper()
        is_pos = "POS" in label_txt
        p = 0.88 if is_pos else 0.12
        labels.append(1 if is_pos else 0)
        prob_pos.append(p)
        prob_neg.append(1 - p)
    return np.array(labels), np.array(prob_pos), np.array(prob_neg)


def _predict_triton(texts: list[str]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Triton HTTP inference — expects logits output [batch, 2]."""
    import tritonclient.http as httpclient

    url = os.getenv("TRITON_URL", "http://127.0.0.1:8003")
    model = os.getenv("TRITON_MODEL", "distilbert_sentiment")
    client = httpclient.InferenceServerClient(url=url, verbose=False)
    # Demo payload: byte strings; production uses tokenized INT32 tensors
    payload = json.dumps(texts).encode("utf-8")
    inp = httpclient.InferInput("TEXT", [1], "BYTES")
    inp.set_data_from_numpy(np.array([payload], dtype=object))
    out = httpclient.InferRequestedOutput("LOGITS")
    result = client.infer(model_name=model, inputs=[inp], outputs=[out])
    logits = np.array(result.as_numpy("LOGITS"), dtype=np.float32)
    if logits.ndim == 1:
        logits = logits.reshape(1, -1)
    exp = np.exp(logits - logits.max(axis=1, keepdims=True))
    probs = exp / exp.sum(axis=1, keepdims=True)
    preds = np.argmax(probs, axis=1)
    return preds, probs[:, 1], probs[:, 0]
