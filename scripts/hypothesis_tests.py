"""
Paired hypothesis tests: DistilBERT vs all TF-IDF baselines on the same held-out split.
Writes `hypothesis_tests` into artifacts/results/evaluation.json with effect sizes
and Bonferroni correction for multiple comparisons.

Run: make hypothesis-tests  (after baseline + train + evaluate)
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from transformers import AutoModelForSequenceClassification, AutoTokenizer

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import (  # noqa: E402
    ARTIFACTS_DIR,
    bonferroni_correction,
    compare_classifiers_hypothesis,
    default_test_path,
    default_val_path,
    has_trained_weights,
    load_evaluation_artifact,
    predict_probs,
    save_evaluation_artifact,
    summarize_hypothesis_report,
)

BASELINE_MODELS = (
    ("tfidf_logistic", "tfidf_logistic.joblib"),
    ("tfidf_naive_bayes", "tfidf_naive_bayes.joblib"),
    ("tfidf_svm", "tfidf_svm.joblib"),
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, default=PROJECT_ROOT / "sentiment_model")
    parser.add_argument("--split", choices=("val", "test"), default="test")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--n-bootstrap", type=int, default=500)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if not has_trained_weights(args.model_dir):
        raise SystemExit(f"No weights in {args.model_dir}. Run: make train")

    csv_path = default_val_path() if args.split == "val" else default_test_path()
    if not csv_path.is_file():
        raise SystemExit(f"Missing split CSV: {csv_path}. Run: make preprocess")

    df = pd.read_csv(csv_path)
    texts = df["text"].astype(str).tolist()
    y_true = df["label"].astype(int).values

    print(f"Loading DistilBERT from {args.model_dir}...")
    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(args.model_dir)
    prob_bert = predict_probs(model, tokenizer, texts)

    comparisons = {}
    p_values_for_bonferroni = {}

    for baseline_key, filename in BASELINE_MODELS:
        baseline_path = ARTIFACTS_DIR / "baselines" / filename
        if not baseline_path.is_file():
            print(f"Skipping {baseline_key}: missing {baseline_path} (run: make baseline)")
            continue

        print(f"Comparing vs {baseline_key}...")
        pipe = joblib.load(baseline_path)
        prob_bl = pipe.predict_proba(texts)[:, 1]

        result = compare_classifiers_hypothesis(
            y_true,
            prob_bert,
            prob_bl,
            threshold=args.threshold,
            split=args.split,
            n_bootstrap=args.n_bootstrap,
            seed=args.seed,
            baseline_name=baseline_key,
        )
        comparisons[baseline_key] = result

        prefix = baseline_key
        p_values_for_bonferroni[f"{prefix}_mcnemar"] = result["mcnemar"]["p_value"]
        for metric, block in result["bootstrap_difference"].items():
            p_values_for_bonferroni[f"{prefix}_bootstrap_{metric}"] = block["p_value_two_sided"]

        m = result["mcnemar"]
        es = result["effect_sizes"]
        print(
            f"  McNemar p={m['p_value']:.4g} | "
            f"Cohen's h={es['cohens_h_accuracy']:.3f} ({es['cohens_h_magnitude']})"
        )

    if not comparisons:
        raise SystemExit("No baseline models found. Run: make baseline")

    bonferroni = bonferroni_correction(p_values_for_bonferroni, alpha=0.05)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "split": args.split,
        "threshold": args.threshold,
        "n_bootstrap": args.n_bootstrap,
        "seed": args.seed,
        "description": (
            "McNemar + bootstrap Δ tests for DistilBERT vs each TF-IDF baseline; "
            "Cohen's h effect sizes; Bonferroni correction across all comparisons."
        ),
        "comparisons": comparisons,
        "multiple_comparison_correction": bonferroni,
        # Legacy single-comparison alias (primary baseline)
        "mcnemar": comparisons.get("tfidf_logistic", {}).get("mcnemar"),
        "bootstrap_difference": comparisons.get("tfidf_logistic", {}).get("bootstrap_difference"),
        "effect_sizes": comparisons.get("tfidf_logistic", {}).get("effect_sizes"),
        "takeaway": summarize_hypothesis_report(
            {"comparisons": comparisons, "multiple_comparison_correction": bonferroni}
        ),
    }

    artifact = load_evaluation_artifact() or {}
    ht = artifact.setdefault("hypothesis_tests", {})
    ht[args.split] = report
    artifact["hypothesis_tests"] = ht
    out = save_evaluation_artifact(artifact)
    print(f"\nBonferroni adjusted α = {bonferroni['adjusted_alpha']:.4f} ({bonferroni['n_tests']} tests)")
    print(f"Merged hypothesis_tests into {out}")


if __name__ == "__main__":
    main()
