#!/usr/bin/env python3
"""
Train TF-IDF + LogisticRegression aspect classifier from pseudo-labeled IMDB samples.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.services.aspects import ASPECT_LEXICONS, sentence_aspects  # noqa: E402
from backend.ml_core import split_review_sentences  # noqa: E402

OUT_DIR = ROOT / "artifacts" / "models"
OUT_MODEL = OUT_DIR / "aspect_classifier.joblib"
OUT_META = OUT_DIR / "aspect_classifier.json"


def build_training_rows(csv_path: Path):
    df = pd.read_csv(csv_path)
    texts, labels = [], []
    for _, row in df.iterrows():
        text = str(row.get("text", ""))
        label = int(row.get("label", 0))
        for sent in split_review_sentences(text, max_sentences=8):
            aspects = sentence_aspects(sent)
            if not aspects:
                continue
            for asp in aspects:
                texts.append(f"[{asp}] {sent}")
                labels.append(label)
    return texts, labels


def main():
    csvs = [
        ROOT / "data" / "samples" / "train_small.csv",
        ROOT / "data" / "samples" / "val_small.csv",
        ROOT / "data" / "raw" / "train.csv",
    ]
    texts, labels = [], []
    for path in csvs:
        if path.is_file():
            t, y = build_training_rows(path)
            texts.extend(t)
            labels.extend(y)
    if len(texts) < 5:
        print(f"Too few aspect-tagged rows ({len(texts)}) — add reviews with acting/plot/visuals keywords")
        sys.exit(1)

    pipe = Pipeline(
        [
            ("tfidf", TfidfVectorizer(max_features=8000, ngram_range=(1, 2), min_df=1)),
            ("clf", LogisticRegression(max_iter=500, class_weight="balanced")),
        ]
    )
    pipe.fit(texts, labels)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, OUT_MODEL)
    meta = {
        "n_samples": len(texts),
        "aspects": list(ASPECT_LEXICONS.keys()),
        "source": "data/samples/*.csv",
    }
    OUT_META.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Saved aspect classifier → {OUT_MODEL} ({len(texts)} samples)")


if __name__ == "__main__":
    main()
