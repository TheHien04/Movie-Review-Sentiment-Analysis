"""Unit tests for paired classifier hypothesis tests."""
import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.ml_core import (  # noqa: E402
    bonferroni_correction,
    bootstrap_metric_difference,
    cohens_h,
    compare_classifiers_hypothesis,
    classification_effect_sizes,
    mcnemar_test,
    summarize_hypothesis_block,
    summarize_hypothesis_report,
)


class TestMcNemar:
    def test_no_discordant_pairs(self):
        y = np.array([0, 1, 0, 1])
        pred = np.array([0, 1, 0, 1])
        r = mcnemar_test(y, pred, pred)
        assert r["n_discordant"] == 0
        assert r["p_value"] == 1.0

    def test_clear_winner(self):
        y = np.ones(20, dtype=int)
        pred_a = np.ones(20, dtype=int)
        pred_b = np.zeros(20, dtype=int)
        r = mcnemar_test(y, pred_a, pred_b)
        assert r["discordant_b"] == 20
        assert r["discordant_c"] == 0
        assert r["p_value"] < 0.05
        assert r["significant_005"] is True


class TestBootstrapDifference:
    def test_returns_ci_and_pvalue(self):
        rng = np.random.default_rng(0)
        n = 200
        y = rng.integers(0, 2, n)
        prob_a = rng.random(n)
        prob_b = prob_a * 0.5 + rng.random(n) * 0.5
        out = bootstrap_metric_difference(y, prob_a, prob_b, n_bootstrap=100, seed=0)
        assert "f1" in out
        assert "ci_low" in out["f1"]
        assert "p_value_two_sided" in out["f1"]


class TestCompareClassifiers:
    def test_compare_structure(self):
        rng = np.random.default_rng(1)
        n = 100
        y = rng.integers(0, 2, n)
        pa = rng.random(n)
        pb = pa + rng.normal(0, 0.1, n)
        pb = np.clip(pb, 0, 1)
        r = compare_classifiers_hypothesis(y, pa, pb, n_bootstrap=50, seed=1)
        assert r["split"] == "test"
        assert "mcnemar" in r
        assert "bootstrap_difference" in r
        assert "effect_sizes" in r
        assert "cohens_h_accuracy" in r["effect_sizes"]


class TestEffectSizes:
    def test_cohens_h_zero_when_equal(self):
        assert abs(cohens_h(0.8, 0.8)) < 1e-9

    def test_classification_effect_sizes(self):
        y = np.array([0, 0, 1, 1])
        pa = np.array([0.1, 0.2, 0.8, 0.9])
        pb = np.array([0.2, 0.3, 0.7, 0.8])
        es = classification_effect_sizes(y, pa, pb)
        assert "cohens_h_magnitude" in es
        assert "odds_ratio_discordant" in es


class TestBonferroni:
    def test_adjusted_alpha(self):
        r = bonferroni_correction({"a": 0.01, "b": 0.04, "c": 0.2})
        assert r["n_tests"] == 3
        assert abs(r["adjusted_alpha"] - 0.05 / 3) < 1e-9
        assert r["results"]["a"]["significant_bonferroni"] is True
        assert r["results"]["c"]["significant_bonferroni"] is False


class TestSummarizeHypothesis:
    def test_takeaway_includes_null_hypothesis(self):
        block = {
            "mcnemar": {"significant_005": False, "p_value": 0.15, "discordant_b": 10, "discordant_c": 8},
            "effect_sizes": {"cohens_h_accuracy": 0.02, "cohens_h_magnitude": "negligible"},
            "bootstrap_difference": {
                "accuracy": {"mean_diff": 0.005, "ci_low": -0.001, "ci_high": 0.012},
            },
        }
        tw = summarize_hypothesis_block(block)
        assert "H₀" in tw["null_hypothesis"]
        assert "0.5%" in tw["detail"] or "+0.50%" in tw["detail"]

    def test_report_notes_significant_baselines(self):
        report = {
            "comparisons": {
                "tfidf_logistic": {"mcnemar": {"significant_005": False, "p_value": 0.2}},
                "tfidf_naive_bayes": {"mcnemar": {"significant_005": True, "p_value": 0.001}},
            }
        }
        tw = summarize_hypothesis_report(report)
        assert "naive bayes" in tw["headline"].lower()
