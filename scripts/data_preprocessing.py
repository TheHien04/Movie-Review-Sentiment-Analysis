"""
Build stratified train/val/test splits from IMDB and write to data/raw/.
Run from project root: python scripts/data_preprocessing.py
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

import pandas as pd
from datasets import load_dataset

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUT = PROJECT_ROOT / "data" / "raw"


def clean_html_text(text: str) -> str:
    return re.sub(r"<.*?>", "", text)


def stratified_split(df: pd.DataFrame, seed: int = 42):
    """Per-class 70/15/15 split, then shuffle combined sets."""

    def split_class(df_class: pd.DataFrame):
        df_class = df_class.sample(frac=1, random_state=seed)
        n = len(df_class)
        n_train = int(0.7 * n)
        n_val = int(0.15 * n)
        return (
            df_class.iloc[:n_train],
            df_class.iloc[n_train : n_train + n_val],
            df_class.iloc[n_train + n_val :],
        )

    train_parts, val_parts, test_parts = [], [], []
    for label in (0, 1):
        part = df[df["label"] == label]
        tr, va, te = split_class(part)
        train_parts.append(tr)
        val_parts.append(va)
        test_parts.append(te)

    df_train = pd.concat(train_parts, ignore_index=True).sample(frac=1, random_state=seed)
    df_val = pd.concat(val_parts, ignore_index=True).sample(frac=1, random_state=seed)
    df_test = pd.concat(test_parts, ignore_index=True).sample(frac=1, random_state=seed)
    return df_train, df_val, df_test


def main():
    parser = argparse.ArgumentParser(description="Preprocess IMDB into data/raw CSV splits")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)

    dataset = load_dataset("imdb")
    df = pd.concat(
        [pd.DataFrame(dataset["train"]), pd.DataFrame(dataset["test"])],
        ignore_index=True,
    )
    df["text"] = df["text"].apply(clean_html_text)

    df_train, df_val, df_test = stratified_split(df, seed=args.seed)

    df_train.to_csv(args.output_dir / "train.csv", index=False)
    df_val.to_csv(args.output_dir / "val.csv", index=False)
    df_test.to_csv(args.output_dir / "test.csv", index=False)

    print(f"Wrote splits to {args.output_dir}")
    print(f"  train: {len(df_train)}, val: {len(df_val)}, test: {len(df_test)}")


if __name__ == "__main__":
    main()
