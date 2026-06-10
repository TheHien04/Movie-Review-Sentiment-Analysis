"""Capstone readiness helper tests."""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ml_core import capstone_readiness  # noqa: E402


def test_capstone_readiness_structure():
    status = capstone_readiness()
    assert "items" in status
    assert "score_label" in status
    assert status["total"] >= 8
    ids = {i["id"] for i in status["items"]}
    assert "hypothesis_tests" in ids
    assert "evaluation_json" in ids
