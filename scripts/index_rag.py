"""Index movie reviews into Chroma for RAG. Run: make rag-index"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.rag import index_documents  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--csv", type=Path, default=PROJECT_ROOT / "data" / "samples" / "val_small.csv")
    parser.add_argument("--max-rows", type=int, default=500)
    args = parser.parse_args()

    if not args.csv.is_file():
        raise SystemExit(f"Missing {args.csv} — run: make preprocess or use data/samples/")

    df = pd.read_csv(args.csv).head(args.max_rows)
    texts = df["text"].astype(str).tolist()
    metas = [
        {"label": int(row["label"]), "source": args.csv.name}
        for _, row in df.iterrows()
    ]
    ids = [f"{args.csv.stem}-{i}" for i in range(len(texts))]
    result = index_documents(texts, metadatas=metas, ids=ids)
    print(f"Indexed {result['indexed']} docs — collection total: {result['total']}")


if __name__ == "__main__":
    main()
