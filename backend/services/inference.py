"""Model inference helpers used by API routes."""
from __future__ import annotations

import os
from typing import List, Sequence, Tuple, Union

import numpy as np
import torch


def predict_with_backend(
    model,
    tokenizer,
    texts: Union[str, Sequence[str]],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Local HF or remote backend (vLLM / Triton) via INFERENCE_BACKEND."""
    from backend.services.remote_inference import try_remote_predict

    remote = try_remote_predict(texts)
    if remote is not None:
        return remote
    return predict_sentiment(model, tokenizer, texts)


def predict_sentiment(
    model,
    tokenizer,
    texts: Union[str, Sequence[str]],
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Batch sentiment inference; returns (labels, P(pos), P(neg))."""
    if isinstance(texts, str):
        texts = [texts]
    batch_size = int(os.getenv("BATCH_SIZE", 32))
    max_length = int(os.getenv("MAX_SEQUENCE_LENGTH", 256))
    all_preds: List[int] = []
    all_prob_pos: List[float] = []
    all_prob_neg: List[float] = []

    for i in range(0, len(texts), batch_size):
        batch = list(texts[i : i + batch_size])
        inputs = tokenizer(
            batch, padding=True, truncation=True, max_length=max_length, return_tensors="pt"
        )
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=1)
            preds = torch.argmax(probs, dim=1).cpu().numpy()
            prob_pos = probs[:, 1].cpu().numpy()
            prob_neg = probs[:, 0].cpu().numpy()
        all_preds.extend(preds)
        all_prob_pos.extend(prob_pos)
        all_prob_neg.extend(prob_neg)

    return np.array(all_preds), np.array(all_prob_pos), np.array(all_prob_neg)
