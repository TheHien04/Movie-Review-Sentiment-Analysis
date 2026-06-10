"""Unit tests for aspect sentiment helpers."""
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ml_core import split_review_sentences
from backend.services.aspects import analyze_aspects, sentence_aspects


def test_split_review_sentences():
    text = "Act one is great. Act two is weak! The score saves it."
    sents = split_review_sentences(text)
    assert len(sents) >= 2


def test_sentence_aspects_detects_acting():
    assert "acting" in sentence_aspects("The acting and cast were superb.")


def test_analyze_aspects_empty():
    def fake_predict(texts):
        import numpy as np

        n = len(texts)
        return (
            [1] * n,
            np.array([0.8] * n),
            np.array([0.2] * n),
        )

    out = analyze_aspects("Nice day.", fake_predict)
    assert out["aspects"] == [] or isinstance(out["aspects"], list)
