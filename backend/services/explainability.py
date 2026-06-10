"""Token-level model explainability (input × gradient)."""
from __future__ import annotations

import os
from typing import Any, Dict, List

import numpy as np
import torch


def explain_input_gradient(model, tokenizer, text: str) -> Dict[str, Any]:
    """Compute per-token importance via input × gradient on embedding layer."""
    max_length = int(os.getenv("MAX_SEQUENCE_LENGTH", 256))
    inputs = tokenizer(
        text,
        truncation=True,
        max_length=max_length,
        return_tensors="pt",
        return_offsets_mapping=True,
    )
    offset_mapping = inputs.pop("offset_mapping")[0].tolist()
    input_ids = inputs["input_ids"]
    tokens = tokenizer.convert_ids_to_tokens(input_ids[0])

    embeddings = model.distilbert.embeddings.word_embeddings(input_ids)
    embeddings.retain_grad()

    outputs = model(inputs_embeds=embeddings, attention_mask=inputs["attention_mask"])
    logits = outputs.logits
    pred_class = int(torch.argmax(logits, dim=1).item())
    prob = float(torch.softmax(logits, dim=1)[0, pred_class].item())

    logits[0, pred_class].backward()
    grads = embeddings.grad[0]
    importance = (embeddings[0] * grads).sum(dim=-1).detach().cpu().numpy()

    max_abs = float(np.max(np.abs(importance))) or 1.0
    normalized = (importance / max_abs).tolist()

    token_scores: List[Dict[str, Any]] = []
    for i, (tok, score) in enumerate(zip(tokens, normalized)):
        if tok in ("[CLS]", "[SEP]", "[PAD]"):
            continue
        start, end = offset_mapping[i]
        token_scores.append(
            {
                "token": tok.replace("##", ""),
                "is_subword": tok.startswith("##"),
                "score": round(float(score), 4),
                "char_start": start,
                "char_end": end,
            }
        )

    model.zero_grad()

    return {
        "text": text,
        "label": pred_class,
        "probability": round(prob, 4),
        "method": "input_x_gradient",
        "tokens": token_scores,
    }
