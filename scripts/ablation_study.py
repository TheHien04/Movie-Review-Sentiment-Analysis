"""
Ablation study: measure how max_length, learning_rate, and epoch count
affect DistilBERT fine-tuning on IMDB.

Results are saved to artifacts/results/ablation_results.json and printed
as a formatted table.  This script is CPU-safe but slow — each config
trains for the specified number of epochs on a subset of the train set.

Usage:
    python scripts/ablation_study.py                # full study
    python scripts/ablation_study.py --quick         # fast subset (2 configs each)
    python scripts/ablation_study.py --train-rows 2000  # limit train size
"""
from __future__ import annotations

import argparse
import json
import os
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
    compute_classification_metrics,
    default_test_path,
    default_train_path,
    default_val_path,
    sanitize_for_json,
)

RESULTS_PATH = ARTIFACTS_DIR / "ablation_results.json"

DEFAULT_CONFIG = {
    "max_length": 256,
    "learning_rate": 2e-5,
    "epochs": 3,
}

ABLATION_AXES = {
    "max_length": [64, 128, 256, 512],
    "learning_rate": [1e-5, 2e-5, 5e-5, 1e-4],
    "epochs": [1, 2, 3, 5],
}

ABLATION_AXES_QUICK = {
    "max_length": [128, 256],
    "learning_rate": [2e-5, 5e-5],
    "epochs": [1, 3],
}


def train_and_evaluate(
    train_texts, train_labels, val_texts, val_labels,
    max_length: int, learning_rate: float, epochs: int, seed: int,
) -> dict:
    """Train DistilBERT with given hyperparams and return val metrics."""
    import torch
    from datasets import Dataset
    from transformers import (
        AutoModelForSequenceClassification,
        AutoTokenizer,
        DataCollatorWithPadding,
        Trainer,
        TrainingArguments,
    )

    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    model = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased", num_labels=2,
    )

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=max_length)

    train_ds = Dataset.from_dict({"text": train_texts, "label": train_labels})
    val_ds = Dataset.from_dict({"text": val_texts, "label": val_labels})
    train_ds = train_ds.map(tokenize, batched=True).remove_columns(["text"])
    val_ds = val_ds.map(tokenize, batched=True).remove_columns(["text"])

    tmp_dir = ARTIFACTS_DIR / "ablation_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    args = TrainingArguments(
        output_dir=str(tmp_dir),
        eval_strategy="epoch",
        save_strategy="no",
        learning_rate=learning_rate,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=32,
        num_train_epochs=epochs,
        weight_decay=0.01,
        logging_steps=9999,
        report_to="none",
        seed=seed,
        data_seed=seed,
        disable_tqdm=True,
    )

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        probs = torch.softmax(torch.tensor(logits), dim=1)[:, 1].numpy()
        m = compute_classification_metrics(np.array(labels), probs)
        return {k: m[k] for k in ("accuracy", "f1", "precision", "recall")}

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer=tokenizer),
        compute_metrics=compute_metrics,
    )

    t0 = time.time()
    trainer.train()
    elapsed = time.time() - t0

    eval_result = trainer.evaluate()
    return {
        "accuracy": eval_result["eval_accuracy"],
        "f1": eval_result["eval_f1"],
        "precision": eval_result["eval_precision"],
        "recall": eval_result["eval_recall"],
        "train_time_s": round(elapsed, 1),
    }


def main():
    parser = argparse.ArgumentParser(description="Ablation study for DistilBERT")
    parser.add_argument("--quick", action="store_true", help="Run reduced grid")
    parser.add_argument("--train-rows", type=int, default=3000,
                        help="Max train rows (0=full). Default 3000 for speed.")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    axes = ABLATION_AXES_QUICK if args.quick else ABLATION_AXES

    train_df = pd.read_csv(default_train_path())
    val_df = pd.read_csv(default_val_path())

    if args.train_rows > 0:
        train_df = train_df.sample(n=min(args.train_rows, len(train_df)),
                                   random_state=args.seed)
    train_texts = train_df["text"].astype(str).tolist()
    train_labels = train_df["label"].astype(int).tolist()
    val_texts = val_df["text"].astype(str).tolist()
    val_labels = val_df["label"].astype(int).tolist()

    print(f"Ablation study — train={len(train_texts)}, val={len(val_texts)}")
    print(f"Default config: {DEFAULT_CONFIG}")
    print(f"Axes: {json.dumps({k: [str(v) for v in vs] for k, vs in axes.items()})}")
    print()

    all_results = []

    for axis_name, values in axes.items():
        print(f"━━━ Ablation: {axis_name} ━━━")
        for val in values:
            config = dict(DEFAULT_CONFIG)
            config[axis_name] = val
            label = f"{axis_name}={val}"
            print(f"  {label} ...", end=" ", flush=True)

            result = train_and_evaluate(
                train_texts, train_labels, val_texts, val_labels,
                max_length=config["max_length"],
                learning_rate=config["learning_rate"],
                epochs=config["epochs"],
                seed=args.seed,
            )
            print(f"acc={result['accuracy']:.4f}  f1={result['f1']:.4f}  "
                  f"({result['train_time_s']}s)")

            all_results.append({
                "axis": axis_name,
                "value": val,
                "config": config,
                **result,
            })

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "default_config": DEFAULT_CONFIG,
        "train_rows": len(train_texts),
        "val_rows": len(val_texts),
        "seed": args.seed,
        "results": sanitize_for_json(all_results),
    }

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    with open(RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved to {RESULTS_PATH}")

    print("\n" + "=" * 72)
    print(f"{'Axis':<16} {'Value':<10} {'Accuracy':>10} {'F1':>10} {'Time':>8}")
    print("-" * 72)
    for r in all_results:
        print(f"{r['axis']:<16} {str(r['value']):<10} "
              f"{r['accuracy']:>10.4f} {r['f1']:>10.4f} {r['train_time_s']:>7.1f}s")
    print("=" * 72)


if __name__ == "__main__":
    main()
