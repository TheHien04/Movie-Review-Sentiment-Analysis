"""
Export misclassified reviews from the test split for qualitative error analysis.
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
    default_test_path,
    has_trained_weights,
    load_evaluation_artifact,
    predict_probs,
    save_evaluation_artifact,
)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-dir", type=Path, default=PROJECT_ROOT / "sentiment_model")
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--max-examples", type=int, default=40)
    args = parser.parse_args()

    test_path = default_test_path()
    if not test_path.is_file():
        raise SystemExit(f"Missing {test_path}")
    if not has_trained_weights(args.model_dir):
        raise SystemExit("Train model first: make train")

    df = pd.read_csv(test_path)
    texts = df["text"].astype(str).tolist()
    y_true = df["label"].astype(int).values

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(args.model_dir)
    y_prob = predict_probs(model, tokenizer, texts)
    y_pred = (y_prob >= args.threshold).astype(int)
    wrong = np.where(y_true != y_pred)[0]

    rows = []
    for idx in wrong[: args.max_examples]:
        rows.append(
            {
                "index": int(idx),
                "true_label": int(y_true[idx]),
                "predicted_label": int(y_pred[idx]),
                "prob_positive": float(y_prob[idx]),
                "error_type": "false_positive" if y_pred[idx] == 1 else "false_negative",
                "text_preview": texts[idx][:400],
            }
        )

    out_csv = ARTIFACTS_DIR / "error_analysis_test.csv"
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows).to_csv(out_csv, index=False)
    print(f"Wrote {len(rows)} misclassified examples to {out_csv}")

    artifact = load_evaluation_artifact() or {}
    artifact["error_analysis"] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "split": "test",
        "threshold": args.threshold,
        "n_total": int(len(df)),
        "n_errors": int(len(wrong)),
        "error_rate": float(len(wrong) / len(df)),
        "export_path": str(out_csv),
        "sample_count": len(rows),
    }
    save_evaluation_artifact(artifact)


if __name__ == "__main__":
    main()
