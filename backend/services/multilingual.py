"""
Lazy-loaded multilingual sentiment model (XLM-RoBERTa or env override).
"""
from __future__ import annotations

import logging
import os
from typing import List, Optional, Sequence, Tuple, Union

import numpy as np

logger = logging.getLogger(__name__)

_HUB_ID = os.getenv(
    "HUB_MODEL_MULTILINGUAL",
    "cardiffnlp/twitter-xlm-roberta-base-sentiment",
)
_HF_REVISION = os.getenv("HF_MODEL_REVISION", "main")

_tokenizer = None
_model = None


def multilingual_available() -> bool:
    return bool(_HUB_ID.strip())


def _ensure_loaded():
    global _tokenizer, _model
    if _model is not None:
        return
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    logger.info("Loading multilingual model %s", _HUB_ID)
    _tokenizer = AutoTokenizer.from_pretrained(_HUB_ID, revision=_HF_REVISION)
    _model = AutoModelForSequenceClassification.from_pretrained(_HUB_ID, revision=_HF_REVISION)
    _model.eval()


def predict_multilingual(texts: Union[str, Sequence[str]]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns labels where 1=positive, 0=negative (maps model labels if needed)."""
    import torch

    _ensure_loaded()
    if isinstance(texts, str):
        texts = [texts]

    batch_size = int(os.getenv("BATCH_SIZE", 32))
    max_length = int(os.getenv("MAX_SEQUENCE_LENGTH", 256))
    all_preds: List[int] = []
    all_prob_pos: List[float] = []
    all_prob_neg: List[float] = []

    for i in range(0, len(texts), batch_size):
        batch = list(texts[i : i + batch_size])
        inputs = _tokenizer(
            batch, padding=True, truncation=True, max_length=max_length, return_tensors="pt"
        )
        with torch.no_grad():
            logits = _model(**inputs).logits
            probs = torch.softmax(logits, dim=1)
            # cardiffnlp: 0=negative, 1=neutral, 2=positive — map to binary
            if probs.shape[1] == 3:
                prob_neg = probs[:, 0].cpu().numpy()
                prob_pos = probs[:, 2].cpu().numpy()
                preds = (prob_pos >= prob_neg).astype(int)
            else:
                preds = torch.argmax(probs, dim=1).cpu().numpy()
                prob_pos = probs[:, 1].cpu().numpy()
                prob_neg = probs[:, 0].cpu().numpy()
        all_preds.extend(preds)
        all_prob_pos.extend(prob_pos)
        all_prob_neg.extend(prob_neg)

    return np.array(all_preds), np.array(all_prob_pos), np.array(all_prob_neg)


def hub_model_id() -> str:
    return _HUB_ID
