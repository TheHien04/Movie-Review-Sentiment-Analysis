"""
Aspect-based sentiment — maps review spans to film critique dimensions (no retraining).
"""
from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple

from backend.ml_core import format_single_prediction, split_review_sentences

ASPECT_LEXICONS: Dict[str, List[str]] = {
    "acting": [
        "acting", "performance", "performances", "cast", "actor", "actress",
        "stars", "lead", "ensemble", "chemistry", "portrayal", "role",
    ],
    "plot": [
        "plot", "story", "storyline", "narrative", "script", "screenplay",
        "twist", "ending", "finale", "writing", "dialogue", "twists",
    ],
    "visuals": [
        "cinematography", "visual", "visuals", "camera", "shot", "shots",
        "frame", "frames", "cgi", "effects", "production design", "look",
    ],
    "pacing": [
        "pacing", "pace", "slow", "drags", "rushed", "runtime", "length",
        "tedious", "boring", "gripping", "tension", "momentum",
    ],
    "sound": [
        "soundtrack", "score", "music", "audio", "sound", "mix",
        "composer", "song", "songs",
    ],
}

ASPECT_LABELS = {
    "acting": "Acting & cast",
    "plot": "Plot & script",
    "visuals": "Visuals & craft",
    "pacing": "Pacing & tension",
    "sound": "Score & sound",
}


def sentence_aspects(sentence: str) -> List[str]:
    lower = sentence.lower()
    matched = []
    for aspect, keywords in ASPECT_LEXICONS.items():
        if any(kw in lower for kw in keywords):
            matched.append(aspect)
    return matched


def analyze_aspects(
    text: str,
    predict_batch: Callable[[List[str]], Tuple],
) -> Dict[str, Any]:
    """
    Tag sentences by aspect keywords, run classifier on each tagged sentence,
    aggregate Fresh score per aspect.
    """
    sentences = split_review_sentences(text, max_sentences=20)
    if not sentences:
        return {"aspects": [], "coverage": 0.0}

    tagged: List[Tuple[str, str]] = []
    for sent in sentences:
        for aspect in sentence_aspects(sent):
            tagged.append((aspect, sent))

    if not tagged:
        return {
            "aspects": [],
            "coverage": 0.0,
            "note": "No aspect keywords detected — try mentioning acting, plot, visuals, pacing, or score.",
        }

    unique_sents = list({s for _, s in tagged})
    preds, prob_pos, prob_neg = predict_batch(unique_sents)
    sent_map: Dict[str, Dict[str, Any]] = {}
    for sent, label, pp, pn in zip(unique_sents, preds, prob_pos, prob_neg):
        sent_map[sent] = format_single_prediction(int(label), float(pp), float(pn))

    buckets: Dict[str, List[Dict[str, Any]]] = {k: [] for k in ASPECT_LEXICONS}
    for aspect, sent in tagged:
        buckets[aspect].append(sent_map[sent])

    aspects_out = []
    for key in ASPECT_LEXICONS:
        rows = buckets[key]
        if not rows:
            continue
        fresh = sum(1 for r in rows if r["label"] == 1)
        avg_conf = sum(r["confidence"] for r in rows) / len(rows)
        avg_pos = sum(r["probability_positive"] for r in rows) / len(rows)
        aspects_out.append(
            {
                "id": key,
                "label": ASPECT_LABELS[key],
                "mentions": len(rows),
                "fresh_ratio": round(fresh / len(rows), 3),
                "sentiment": "positive" if fresh / len(rows) >= 0.5 else "negative",
                "label_id": 1 if fresh / len(rows) >= 0.5 else 0,
                "confidence": round(avg_conf, 4),
                "probability_positive": round(avg_pos, 4),
                "sample": next(s for a, s in tagged if a == key)[:120],
            }
        )

    covered = len({a for a, _ in tagged})
    return {
        "aspects": aspects_out,
        "coverage": round(covered / len(ASPECT_LEXICONS), 3),
        "sentences_scanned": len(sentences),
    }
