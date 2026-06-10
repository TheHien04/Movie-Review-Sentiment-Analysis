"""
TF-IDF baselines (Logistic Regression, Naive Bayes, SVM) on the same IMDB
splits as DistilBERT.  Writes/merges `baselines` into
artifacts/results/evaluation.json.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import (  # noqa: E402
    ARTIFACTS_DIR,
    bootstrap_metric_cis,
    compute_classification_metrics,
    default_test_path,
    default_train_path,
    default_val_path,
    load_evaluation_artifact,
    save_evaluation_artifact,
)
from backend.experiment_tracking import experiment_run, log_metrics, log_params  # noqa: E402


def load_xy(path: Path):
    df = pd.read_csv(path)
    return df["text"].astype(str).tolist(), df["label"].astype(int).values


def evaluate_pipeline(pipe: Pipeline, texts, y_true, threshold: float = 0.5):
    prob_pos = pipe.predict_proba(texts)[:, 1]
    metrics = compute_classification_metrics(y_true, prob_pos, threshold)
    metrics["confidence_intervals"] = bootstrap_metric_cis(y_true, prob_pos, threshold)
    return metrics


def build_pipelines(max_features: int, seed: int):
    """Return a list of (key, display_name, description, Pipeline) tuples."""
    tfidf_params = dict(
        max_features=max_features,
        ngram_range=(1, 2),
        min_df=2,
        sublinear_tf=True,
    )

    return [
        (
            "tfidf_logistic",
            "tfidf_logistic_regression",
            f"TF-IDF (1-2 grams, max_features={max_features}) + balanced logistic regression",
            Pipeline([
                ("tfidf", TfidfVectorizer(**tfidf_params)),
                ("clf", LogisticRegression(
                    max_iter=1000,
                    class_weight="balanced",
                    random_state=seed,
                    n_jobs=-1,
                )),
            ]),
        ),
        (
            "tfidf_naive_bayes",
            "tfidf_multinomial_nb",
            f"TF-IDF (1-2 grams, max_features={max_features}) + MultinomialNB (alpha=1.0)",
            Pipeline([
                ("tfidf", TfidfVectorizer(**tfidf_params)),
                ("clf", MultinomialNB(alpha=1.0)),
            ]),
        ),
        (
            "tfidf_svm",
            "tfidf_linear_svc",
            f"TF-IDF (1-2 grams, max_features={max_features}) + CalibratedClassifierCV(LinearSVC)",
            Pipeline([
                ("tfidf", TfidfVectorizer(**tfidf_params)),
                ("clf", CalibratedClassifierCV(
                    LinearSVC(max_iter=2000, random_state=seed),
                    cv=3,
                )),
            ]),
        ),
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-features", type=int, default=50000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    train_path = default_train_path()
    val_path = default_val_path()
    test_path = default_test_path()
    for p in (train_path, val_path, test_path):
        if not p.is_file():
            raise SystemExit(f"Missing split: {p}. Run: make preprocess")

    x_train, y_train = load_xy(train_path)

    baselines_dir = ARTIFACTS_DIR / "baselines"
    baselines_dir.mkdir(parents=True, exist_ok=True)

    pipelines = build_pipelines(args.max_features, args.seed)
    baseline_reports: dict[str, dict] = {}

    for key, model_name, description, pipe in pipelines:
        print(f"\nTraining {model_name} on train split...")
        with experiment_run(
            "cinesentiment-baselines",
            run_name=key,
            params={"baseline": key, "max_features": args.max_features, "seed": args.seed},
        ):
            pipe.fit(x_train, y_train)

            model_path = baselines_dir / f"{key}.joblib"
            joblib.dump(pipe, model_path)
            print(f"  Saved model to {model_path}")

        report = {
            "model": model_name,
            "description": description,
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "seed": args.seed,
            "splits": {},
            "summary": {},
        }

        for split_name, split_path in (("val", val_path), ("test", test_path)):
            texts, y_true = load_xy(split_path)
            metrics = evaluate_pipeline(pipe, texts, y_true)
            report["splits"][split_name] = {
                "split": split_name,
                "dataset_path": str(split_path),
                "n_samples": len(y_true),
                "metrics": metrics,
            }
            report["summary"][f"{split_name}_accuracy"] = metrics["accuracy"]
            report["summary"][f"{split_name}_f1"] = metrics["f1"]
            print(f"  {split_name}: accuracy={metrics['accuracy']:.4f} f1={metrics['f1']:.4f}")
            if split_name == "test":
                with experiment_run("cinesentiment-baselines", run_name=f"{key}-metrics"):
                    log_metrics(
                        {
                            "test_accuracy": metrics.get("accuracy"),
                            "test_f1": metrics.get("f1"),
                        }
                    )

        baseline_reports[key] = report

    # -- comparison table --
    print("\n" + "=" * 72)
    print(f"{'Baseline':<28} {'Test Accuracy':>14} {'Test F1':>10}")
    print("-" * 72)
    for key, report in baseline_reports.items():
        acc = report["summary"].get("test_accuracy", float("nan"))
        f1 = report["summary"].get("test_f1", float("nan"))
        print(f"{report['model']:<28} {acc:>14.4f} {f1:>10.4f}")
    print("=" * 72)

    artifact = load_evaluation_artifact() or {}
    artifact.setdefault("baselines", {})
    artifact["baselines"].update(baseline_reports)
    artifact.setdefault(
        "methodology",
        "Held-out val/test; sklearn metrics; DistilBERT vs TF-IDF baseline on identical splits.",
    )
    save_evaluation_artifact(artifact)
    print(f"\nMerged baselines into {ARTIFACTS_DIR / 'evaluation.json'}")


if __name__ == "__main__":
    main()
