"""
Write a reproducibility log after `make capstone`.
Output: artifacts/results/capstone_run_log.json
"""
from __future__ import annotations

import json
import os
import platform
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import ARTIFACTS_DIR, load_evaluation_artifact  # noqa: E402

LOG_PATH = ARTIFACTS_DIR / "capstone_run_log.json"


def _git_commit() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=PROJECT_ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def _app_version() -> str | None:
    vfile = PROJECT_ROOT / "VERSION"
    return vfile.read_text(encoding="utf-8").strip() if vfile.is_file() else None


def _pytest_collected() -> str | None:
    try:
        out = subprocess.check_output(
            [sys.executable, "-m", "pytest", "tests/", "--collect-only", "-q"],
            cwd=PROJECT_ROOT,
            text=True,
            stderr=subprocess.STDOUT,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    for line in reversed(out.strip().splitlines()):
        if "test" in line.lower():
            return line.strip()
    return None


def build_log() -> dict:
    artifact = load_evaluation_artifact() or {}
    test_split = artifact.get("splits", {}).get("test", {})
    test_m = test_split.get("metrics", {})
    ht = artifact.get("hypothesis_tests", {}).get("test", {})
    mcn = ht.get("mcnemar", {})
    boot = ht.get("bootstrap_difference", {})

    return {
        "completed_at_utc": datetime.now(timezone.utc).isoformat(),
        "app_version": _app_version(),
        "git_commit": _git_commit(),
        "python": platform.python_version(),
        "platform": platform.platform(),
        "pipeline": "make capstone",
        "steps": [
            "baseline",
            "train",
            "evaluate",
            "error-analysis",
            "insights-curves",
            "hypothesis-tests",
            "sync-docs",
            "test",
            "release-check",
            "log-capstone",
        ],
        "test_split": {
            "n": test_split.get("n"),
            "accuracy": test_m.get("accuracy"),
            "f1": test_m.get("f1"),
            "roc_auc": test_m.get("roc_auc"),
        },
        "hypothesis_tests": {
            "mcnemar_p": mcn.get("p_value"),
            "mcnemar_significant_005": mcn.get("significant_005"),
            "bootstrap_delta_f1_p": (boot.get("f1") or {}).get("p_value_two_sided"),
        },
        "pytest": os.environ.get("CAPSTONE_PYTEST_NOTE") or _pytest_collected(),
        "artifacts": {
            "evaluation_json": "artifacts/results/evaluation.json",
            "stats_report": "docs/STATS_REPORT.md",
            "error_analysis": "artifacts/results/error_analysis_test.csv",
        },
    }


def main() -> None:
    log = build_log()
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    LOG_PATH.write_text(json.dumps(log, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {LOG_PATH}")
    print(json.dumps(log, indent=2))


if __name__ == "__main__":
    main()
