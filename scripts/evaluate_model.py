"""
Evaluate saved model on val/test splits; write artifacts/results/evaluation.json.
Run: python scripts/evaluate_model.py --model-dir sentiment_model
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from transformers import AutoModelForSequenceClassification, AutoTokenizer

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import (  # noqa: E402
    ARTIFACTS_DIR,
    bootstrap_metric_cis,
    compute_classification_metrics,
    default_test_path,
    default_val_path,
    has_trained_weights,
    load_evaluation_artifact,
    predict_probs,
    roc_curve_points,
    save_evaluation_artifact,
    threshold_curve_points,
)


def evaluate_split(model, tokenizer, csv_path: Path, split_name: str, threshold: float = 0.5):
    df = pd.read_csv(csv_path)
    texts = df["text"].astype(str).tolist()
    y_true = df["label"].astype(int).values
    y_prob = predict_probs(model, tokenizer, texts)
    metrics = compute_classification_metrics(y_true, y_prob, threshold)
    metrics["confidence_intervals"] = bootstrap_metric_cis(y_true, y_prob, threshold)
    return {
        "split": split_name,
        "dataset_path": str(csv_path),
        "n_samples": len(df),
        "threshold": threshold,
        "metrics": metrics,
        "curves": {
            "threshold_curve": threshold_curve_points(y_true, y_prob),
            "roc_curve": roc_curve_points(y_true, y_prob),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, default=PROJECT_ROOT / "sentiment_model")
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    if not has_trained_weights(args.model_dir):
        raise SystemExit(f"No weights in {args.model_dir}. Train first: python scripts/model_training.py")

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(args.model_dir)

    val_path = default_val_path()
    test_path = default_test_path()

    existing = load_evaluation_artifact() or {}
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_dir": str(args.model_dir),
        "model_source": "imdb_finetuned_local",
        "methodology": "sklearn metrics on held-out splits; bootstrap 95% CI (500 resamples)",
        "training": existing.get("training"),
        "splits": {},
        "summary": {},
        "curves": {},
    }
    if existing.get("baselines"):
        report["baselines"] = existing["baselines"]
    if existing.get("error_analysis"):
        report["error_analysis"] = existing["error_analysis"]
    if existing.get("hypothesis_tests"):
        report["hypothesis_tests"] = existing["hypothesis_tests"]

    for name, path in (("val", val_path), ("test", test_path)):
        if not path.is_file():
            print(f"Skip missing split: {path}")
            continue
        split_report = evaluate_split(model, tokenizer, path, name, args.threshold)
        report["splits"][name] = {
            "split": split_report["split"],
            "dataset_path": split_report["dataset_path"],
            "n_samples": split_report["n_samples"],
            "threshold": split_report["threshold"],
            "metrics": split_report["metrics"],
        }
        if split_report.get("curves"):
            report["curves"][name] = split_report["curves"]
        report["summary"][f"{name}_accuracy"] = split_report["metrics"]["accuracy"]
        report["summary"][f"{name}_f1"] = split_report["metrics"]["f1"]

    out = save_evaluation_artifact(report)
    print(f"Wrote {out}")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
