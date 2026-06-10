"""
LoRA fine-tune DistilBERT (PEFT) — modern adapter training vs full fine-tune.
Quick mode: --max-train-rows 500 --epochs 1
Run: make lora-train  |  make lora-quick
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from datasets import Dataset
from peft import LoraConfig, TaskType, get_peft_model
from sklearn.metrics import accuracy_score, f1_score
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    DataCollatorWithPadding,
    Trainer,
    TrainingArguments,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import ARTIFACTS_DIR, compute_classification_metrics  # noqa: E402
from backend.experiment_tracking import experiment_run, log_metrics, log_params  # noqa: E402

DATA_DIR = PROJECT_ROOT / "data" / "raw"
LORA_OUT = PROJECT_ROOT / "sentiment_model_lora"
COMPARISON_JSON = ARTIFACTS_DIR / "lora_comparison.json"


def load_splits(max_train: int, seed: int):
    train_df = pd.read_csv(DATA_DIR / "train.csv")
    val_df = pd.read_csv(DATA_DIR / "val.csv")
    test_df = pd.read_csv(DATA_DIR / "test.csv")
    if max_train > 0:
        train_df = train_df.sample(n=min(max_train, len(train_df)), random_state=seed)
    return train_df, val_df, test_df


def evaluate(model, tokenizer, df, max_length: int = 256):
    texts = df["text"].astype(str).tolist()
    labels = df["label"].astype(int).values
    preds, prob_pos, _ = [], [], []
    model.eval()
    for i in range(0, len(texts), 32):
        batch = texts[i : i + 32]
        inputs = tokenizer(
            batch, padding=True, truncation=True, max_length=max_length, return_tensors="pt"
        )
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=1)
        preds.extend(torch.argmax(probs, dim=1).cpu().numpy())
        prob_pos.extend(probs[:, 1].cpu().numpy())
    return compute_classification_metrics(labels, np.array(prob_pos))


def load_baseline_metrics() -> dict | None:
    eval_path = ARTIFACTS_DIR / "evaluation.json"
    if not eval_path.is_file():
        return None
    data = json.loads(eval_path.read_text(encoding="utf-8"))
    return data.get("splits", {}).get("test", {}).get("metrics")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-train-rows", type=int, default=500)
    parser.add_argument("--lora-r", type=int, default=8)
    parser.add_argument("--lora-alpha", type=int, default=16)
    parser.add_argument("--out", type=Path, default=LORA_OUT)
    args = parser.parse_args()

    train_df, val_df, test_df = load_splits(args.max_train_rows, args.seed)
    tokenizer = AutoTokenizer.from_pretrained("distilbert-base-uncased")
    base = AutoModelForSequenceClassification.from_pretrained(
        "distilbert-base-uncased", num_labels=2
    )
    lora_cfg = LoraConfig(
        task_type=TaskType.SEQ_CLS,
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        lora_dropout=0.05,
        target_modules=["q_lin", "v_lin"],
    )
    model = get_peft_model(base, lora_cfg)
    model.print_trainable_parameters()

    max_length = 256

    def tok(batch):
        return tokenizer(batch["text"], truncation=True, max_length=max_length)

    train_ds = Dataset.from_pandas(train_df[["text", "label"]]).map(tok, batched=True)
    val_ds = Dataset.from_pandas(val_df[["text", "label"]]).map(tok, batched=True)
    train_ds = train_ds.remove_columns(["text"])
    val_ds = val_ds.remove_columns(["text"])

    lora_params = {
        "method": "peft_lora",
        "base_model": "distilbert-base-uncased",
        "epochs": args.epochs,
        "max_train_rows": args.max_train_rows,
        "lora_r": args.lora_r,
        "lora_alpha": args.lora_alpha,
        "seed": args.seed,
    }
    with experiment_run(
        "cinesentiment-lora",
        run_name=f"lora-r{args.lora_r}-e{args.epochs}",
        params=lora_params,
    ):

        training_args = TrainingArguments(
            output_dir=str(ARTIFACTS_DIR / "lora_checkpoints"),
            eval_strategy="epoch",
            save_strategy="no",
            learning_rate=2e-4,
            per_device_train_batch_size=16,
            per_device_eval_batch_size=32,
            num_train_epochs=args.epochs,
            report_to="none",
            seed=args.seed,
            logging_steps=50,
        )

        def compute_metrics(eval_pred):
            logits, labels = eval_pred
            preds = np.argmax(logits, axis=1)
            return {
                "accuracy": accuracy_score(labels, preds),
                "f1": f1_score(labels, preds, average="binary"),
            }

        trainer = Trainer(
            model=model,
            args=training_args,
            train_dataset=train_ds,
            eval_dataset=val_ds,
            tokenizer=tokenizer,
            data_collator=DataCollatorWithPadding(tokenizer),
            compute_metrics=compute_metrics,
        )
        print("LoRA training…")
        trainer.train()

        test_metrics = evaluate(model, tokenizer, test_df)
        log_metrics({f"test_{k}": v for k, v in test_metrics.items() if isinstance(v, (int, float))})

    args.out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(args.out))
    tokenizer.save_pretrained(str(args.out))

    baseline = load_baseline_metrics()
    comparison = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "method": "peft_lora_distilbert",
        "train_rows": len(train_df),
        "epochs": args.epochs,
        "lora": {"r": args.lora_r, "alpha": args.lora_alpha},
        "test_metrics_lora": test_metrics,
        "test_metrics_full_finetune": baseline,
        "delta_f1_vs_full": (
            (test_metrics.get("f1") or 0) - (baseline.get("f1") or 0) if baseline else None
        ),
        "note": "LoRA trains fewer params; compare on same test split. Full fine-tune from evaluation.json.",
    }
    COMPARISON_JSON.parent.mkdir(parents=True, exist_ok=True)
    COMPARISON_JSON.write_text(json.dumps(comparison, indent=2) + "\n", encoding="utf-8")
    print("LoRA test metrics:", test_metrics)
    if baseline:
        print(f"Full fine-tune F1: {baseline.get('f1'):.4f} | LoRA F1: {test_metrics.get('f1', 0):.4f}")
    print(f"Wrote {COMPARISON_JSON}")


if __name__ == "__main__":
    main()
