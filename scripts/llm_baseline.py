"""
LLM zero-shot sentiment baseline (GPT-4o-mini or demo rules).
Evaluates on a test subset and merges into evaluation.json.

Usage:
  OPENAI_API_KEY=sk-... python scripts/llm_baseline.py --max-rows 200
  python scripts/llm_baseline.py --demo --max-rows 100   # no API key (lexicon demo)
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import (  # noqa: E402
    ARTIFACTS_DIR,
    bootstrap_metric_cis,
    compute_classification_metrics,
    default_test_path,
    load_evaluation_artifact,
    save_evaluation_artifact,
)
from backend.experiment_tracking import experiment_run, log_metrics, log_params  # noqa: E402

POS_WORDS = {
    "great", "excellent", "amazing", "wonderful", "fantastic", "love", "best",
    "brilliant", "superb", "enjoyed", "perfect", "masterpiece", "recommend",
}
NEG_WORDS = {
    "bad", "terrible", "awful", "boring", "waste", "worst", "hate", "poor",
    "disappointing", "dull", "stupid", "horrible", "weak", "failed",
}


def _demo_predict(texts: list[str]) -> np.ndarray:
    probs = []
    for t in texts:
        words = set(re.findall(r"[a-z]+", t.lower()))
        pos = len(words & POS_WORDS)
        neg = len(words & NEG_WORDS)
        score = 0.5 + 0.08 * (pos - neg)
        score = min(0.95, max(0.05, score))
        probs.append(score)
    return np.array(probs)


def _openai_predict(texts: list[str], model: str) -> np.ndarray:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    probs = []
    for text in texts:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Classify movie review sentiment. Reply with exactly one word: "
                        "POSITIVE or NEGATIVE."
                    ),
                },
                {"role": "user", "content": text[:3000]},
            ],
            temperature=0,
            max_tokens=10,
        )
        label = (resp.choices[0].message.content or "").strip().upper()
        probs.append(0.85 if "POS" in label else 0.15)
        time.sleep(0.05)
    return np.array(probs)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-rows", type=int, default=150, help="Test rows (API cost control)")
    parser.add_argument("--model", default=os.getenv("LLM_BASELINE_MODEL", "gpt-4o-mini"))
    parser.add_argument("--demo", action="store_true", help="Lexicon demo without OpenAI")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    test_path = default_test_path()
    if not test_path.is_file():
        raise SystemExit(f"Missing {test_path}")

    df = pd.read_csv(test_path)
    if args.max_rows > 0:
        df = df.sample(n=min(args.max_rows, len(df)), random_state=args.seed)

    texts = df["text"].astype(str).tolist()
    y_true = df["label"].astype(int).values

    use_openai = not args.demo and bool(os.getenv("OPENAI_API_KEY"))
    mode = f"openai:{args.model}" if use_openai else "demo_lexicon"

    with experiment_run("cinesentiment-llm-baseline", run_name=mode):
        log_params({"mode": mode, "max_rows": len(df), "model": args.model if use_openai else "demo"})

        if use_openai:
            print(f"Calling OpenAI {args.model} on {len(df)} reviews…")
            prob_pos = _openai_predict(texts, args.model)
        else:
            print(f"Demo lexicon baseline on {len(df)} reviews (set OPENAI_API_KEY for real LLM)")
            prob_pos = _demo_predict(texts)

        metrics = compute_classification_metrics(y_true, prob_pos)
        metrics["confidence_intervals"] = bootstrap_metric_cis(y_true, prob_pos)
        log_metrics({f"test_{k}": v for k, v in metrics.items() if isinstance(v, (int, float))})

    report = {
        "model": f"LLM zero-shot ({mode})",
        "description": "GPT-4o-mini zero-shot or demo lexicon when API key unset",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "n_samples": len(df),
        "splits": {
            "test": {
                "split": "test",
                "dataset_path": str(test_path),
                "n_samples": len(df),
                "metrics": metrics,
            }
        },
        "summary": {
            "test_accuracy": metrics["accuracy"],
            "test_f1": metrics["f1"],
        },
    }

    out = ARTIFACTS_DIR / "llm_baseline.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"LLM baseline — accuracy={metrics['accuracy']:.4f} f1={metrics['f1']:.4f}")
    print(f"Wrote {out}")

    artifact = load_evaluation_artifact() or {}
    artifact.setdefault("baselines", {})
    key = "llm_gpt4o_mini" if use_openai else "llm_demo_lexicon"
    artifact["baselines"][key] = report
    save_evaluation_artifact(artifact)
    print(f"Merged into evaluation.json as baselines.{key}")


if __name__ == "__main__":
    main()
