"""Rewrite artifacts without Infinity/NaN (browser-safe JSON)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import (  # noqa: E402
    ARTIFACTS_DIR,
    load_evaluation_artifact,
    sanitize_for_json,
    save_evaluation_artifact,
)


def main():
    artifact = load_evaluation_artifact()
    if artifact:
        save_evaluation_artifact(artifact)
        print("Repaired evaluation.json")

    path = ARTIFACTS_DIR / "insights_curves.json"
    if path.is_file():
        data = sanitize_for_json(json.loads(path.read_text(encoding="utf-8")))
        path.write_text(json.dumps(data, indent=2, allow_nan=False), encoding="utf-8")
        print("Repaired insights_curves.json")


if __name__ == "__main__":
    main()
