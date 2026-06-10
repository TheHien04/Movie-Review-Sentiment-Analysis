#!/usr/bin/env python3
"""Build Feast offline parquet + materialize online store from sample reviews."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import default_val_path  # noqa: E402
from backend.services.feature_store import compute_text_features  # noqa: E402

FEAST_DIR = PROJECT_ROOT / "data" / "feast"
PARQUET = FEAST_DIR / "review_features.parquet"
ONLINE_JSON = FEAST_DIR / "online_features.json"


def build_parquet(max_rows: int = 500) -> int:
    FEAST_DIR.mkdir(parents=True, exist_ok=True)
    val = default_val_path()
    if not val.is_file():
        print(f"Missing {val} — skipping parquet build")
        return 0
    df = pd.read_csv(val).head(max_rows)
    now = datetime.now(timezone.utc)
    rows = []
    online: dict = {}
    for i, row in df.iterrows():
        text = str(row.get("review", row.get("text", "")))
        rid = f"rev_{i}"
        feats = compute_text_features(text)
        rows.append(
            {
                "review_id": rid,
                "event_timestamp": now,
                "char_count": feats["char_count"],
                "word_count": feats["word_count"],
                "avg_word_len": feats["avg_word_len"],
                "exclamation_count": feats["exclamation_count"],
                "text_preview": text[:80],
            }
        )
        online[rid] = feats
    pd.DataFrame(rows).to_parquet(PARQUET, index=False)
    ONLINE_JSON.write_text(json.dumps(online, indent=2), encoding="utf-8")
    return len(rows)


def feast_apply() -> None:
    try:
        from feast import FeatureStore

        sys.path.insert(0, str(PROJECT_ROOT / "feature_repo"))
        from review_features import review_features as rv  # type: ignore

        fs = FeatureStore(repo_path=str(PROJECT_ROOT / "feature_repo"))
        fs.apply([rv])
        end = datetime.now(timezone.utc)
        start = end.replace(year=end.year - 1)
        fs.materialize(start, end)
        print("Feast materialize complete")
    except Exception as exc:
        print(f"Feast materialize skipped: {exc}")


def main() -> None:
    n = build_parquet()
    print(f"Wrote {PARQUET} ({n} rows)")
    feast_apply()


if __name__ == "__main__":
    main()
