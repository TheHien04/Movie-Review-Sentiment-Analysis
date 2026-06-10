"""
Fine-tune DistilBERT on data/raw splits; save weights + evaluation artifact.
Run from project root: python scripts/model_training.py
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from datasets import Dataset
from sklearn.metrics import confusion_matrix
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import (  # noqa: E402
    ARTIFACTS_DIR,
    compute_classification_metrics,
    load_evaluation_artifact,
    save_evaluation_artifact,
)
from backend.experiment_tracking import experiment_run, log_artifact, log_metrics, log_params  # noqa: E402

DATA_DIR = PROJECT_ROOT / "data" / "raw"
MODEL_OUT = PROJECT_ROOT / "sentiment_model"


def load_splits():
    train_df = pd.read_csv(DATA_DIR / "train.csv")
    val_df = pd.read_csv(DATA_DIR / "val.csv")
    test_df = pd.read_csv(DATA_DIR / "test.csv")
    return train_df, val_df, test_df


def build_trainer(model, tokenizer, train_ds, val_ds, output_dir: Path, epochs: int, seed: int):
    data_collator = DataCollatorWithPadding(tokenizer=tokenizer)

    import torch

    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        probs = torch.softmax(torch.tensor(logits), dim=1)[:, 1].numpy()
        m = compute_classification_metrics(np.array(labels), probs)
        return {k: m[k] for k in ("accuracy", "f1", "precision", "recall")}

    training_args = TrainingArguments(
        output_dir=str(output_dir / "checkpoints"),
        eval_strategy="epoch",
        save_strategy="epoch",
        learning_rate=2e-5,
        per_device_train_batch_size=16,
        per_device_eval_batch_size=16,
        num_train_epochs=epochs,
        weight_decay=0.01,
        logging_dir=str(output_dir / "logs"),
        logging_steps=100,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        save_total_limit=2,
        report_to="none",
        seed=seed,
        data_seed=seed,
        remove_unused_columns=True,
    )

    return Trainer(
        model=model,
        args=training_args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        data_collator=data_collator,
        compute_metrics=compute_metrics,
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-train-rows", type=int, default=0, help="0 = full train set")
    parser.add_argument("--model-out", type=Path, default=MODEL_OUT)
    args = parser.parse_args()

    train_df, val_df, test_df = load_splits()
    if args.max_train_rows > 0:
        train_df = train_df.sample(n=min(args.max_train_rows, len(train_df)), random_state=args.seed)

    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    model = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased", num_labels=2
    )

    max_length = int(os.getenv("MAX_SEQUENCE_LENGTH", "256"))

    def tokenize(batch):
        return tokenizer(batch["text"], truncation=True, max_length=max_length)

    train_ds = Dataset.from_pandas(train_df[["text", "label"]]).map(tokenize, batched=True)
    val_ds = Dataset.from_pandas(val_df[["text", "label"]]).map(tokenize, batched=True)
    test_ds = Dataset.from_pandas(test_df[["text", "label"]]).map(tokenize, batched=True)

    train_ds = train_ds.remove_columns(["text"])
    val_ds = val_ds.remove_columns(["text"])
    test_ds = test_ds.remove_columns(["text"])

    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    run_params = {
        "model": "distilbert-base-uncased",
        "epochs": args.epochs,
        "seed": args.seed,
        "max_train_rows": args.max_train_rows or len(train_df),
        "max_length": max_length,
    }
    with experiment_run(
        "cinesentiment-distilbert",
        run_name=f"epochs{args.epochs}-seed{args.seed}",
        params=run_params,
    ):
        trainer = build_trainer(
            model, tokenizer, train_ds, val_ds, ARTIFACTS_DIR, args.epochs, args.seed
        )

        print("Starting training...")
        trainer.train()

        def _eval_split(dataset, split_name):
            out = trainer.predict(dataset)
            probs = torch.softmax(torch.tensor(out.predictions), dim=1)[:, 1].numpy()
            metrics = compute_classification_metrics(np.array(out.label_ids), probs)
            return metrics

        print("Evaluating on validation set...")
        val_metrics = _eval_split(val_ds, "val")

        print("Evaluating on test set...")
        test_metrics = _eval_split(test_ds, "test")

        preds_output = trainer.predict(test_ds)
        preds = np.argmax(preds_output.predictions, axis=1)
        cm = confusion_matrix(preds_output.label_ids, preds, labels=[0, 1])

        try:
            import matplotlib.pyplot as plt
            from sklearn.metrics import ConfusionMatrixDisplay

            disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=["Negative", "Positive"])
            disp.plot(cmap="Blues")
            plt.savefig(ARTIFACTS_DIR / "confusion_matrix.png", bbox_inches="tight")
            plt.close()
        except ImportError:
            print("matplotlib not installed; skipping confusion matrix plot")

        log_metrics(
            {
                "val_accuracy": val_metrics.get("accuracy"),
                "val_f1": val_metrics.get("f1"),
                "test_accuracy": test_metrics.get("accuracy"),
                "test_f1": test_metrics.get("f1"),
            }
        )
        cm_path = ARTIFACTS_DIR / "confusion_matrix.png"
        if cm_path.is_file():
            log_artifact(cm_path)

    args.model_out.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(args.model_out))
    tokenizer.save_pretrained(str(args.model_out))

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_dir": str(args.model_out),
        "model_source": "imdb_finetuned_local",
        "training": {
            "epochs": args.epochs,
            "seed": args.seed,
            "max_train_rows": args.max_train_rows or len(train_df),
        },
        "splits": {
            "val": {
                "split": "val",
                "metrics": val_metrics,
                "threshold": 0.5,
            },
            "test": {
                "split": "test",
                "metrics": test_metrics,
                "threshold": 0.5,
            },
        },
        "summary": {
            "val_accuracy": val_metrics["accuracy"],
            "val_f1": val_metrics["f1"],
            "test_accuracy": test_metrics["accuracy"],
            "test_f1": test_metrics["f1"],
        },
    }
    existing = load_evaluation_artifact() or {}
    if existing.get("baselines"):
        report["baselines"] = existing["baselines"]
    save_evaluation_artifact(report)

    with open(ARTIFACTS_DIR / "metrics.txt", "w", encoding="utf-8") as f:
        for k, v in test_metrics.items():
            if isinstance(v, float):
                f.write(f"{k}: {v:.4f}\n")

    print("Test metrics:", test_metrics)
    print(f"Model saved to {args.model_out}")


if __name__ == "__main__":
    main()
