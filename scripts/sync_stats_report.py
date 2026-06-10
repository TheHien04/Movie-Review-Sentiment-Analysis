"""
Refresh auto-generated numbers in docs/STATS_REPORT.md from evaluation.json.
Run: make sync-docs  (after evaluate / hypothesis-tests)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = PROJECT_ROOT / "VERSION"
sys.path.insert(0, str(PROJECT_ROOT))

from backend.ml_core import ARTIFACTS_DIR, load_evaluation_artifact  # noqa: E402

MARKER_START = "<!-- AUTO_STATS_START -->"
MARKER_END = "<!-- AUTO_STATS_END -->"
DOC_PATH = PROJECT_ROOT / "docs" / "STATS_REPORT.md"


def _pct(v: float, digits: int = 2) -> str:
    return f"{v * 100:.{digits}f}%"


def build_auto_block(artifact: dict) -> str:
    test = artifact.get("splits", {}).get("test", {}).get("metrics", {})
    ci = test.get("confidence_intervals", {})
    bl = (
        artifact.get("baselines", {})
        .get("tfidf_logistic", {})
        .get("splits", {})
        .get("test", {})
        .get("metrics", {})
    )
    ht = artifact.get("hypothesis_tests", {}).get("test", {})
    mcn = ht.get("mcnemar", {})
    boot = ht.get("bootstrap_difference", {})

    lines = [
        "## Auto-generated results (from evaluation.json)",
        "",
        f"*Updated by `make sync-docs` — do not edit manually; regenerate after `make capstone`.*",
        "",
        "### Primary test metrics (DistilBERT, τ = 0.5)",
        "",
        "| Metric | Point | 95% CI |",
        "|--------|-------|--------|",
    ]
    for key, label in (
        ("accuracy", "Accuracy"),
        ("f1", "F1"),
        ("precision", "Precision"),
        ("recall", "Recall"),
    ):
        if test.get(key) is None:
            continue
        c = ci.get(key, {})
        ci_str = (
            f"{_pct(c['low'])} – {_pct(c['high'])}"
            if c.get("low") is not None and c.get("high") is not None
            else "—"
        )
        lines.append(f"| **{label}** | {_pct(test[key])} | {ci_str} |")

    if bl:
        lines.append("")
        lines.append("### Baseline (TF-IDF + logistic, test)")
        lines.append("")
        if bl.get("accuracy") is not None:
            lines.append(f"- Accuracy: {_pct(bl['accuracy'])}")
        if bl.get("f1") is not None:
            lines.append(f"- F1: {_pct(bl['f1'])}")
        if test.get("f1") is not None and bl.get("f1") is not None:
            lines.append(f"- ΔF1 (DistilBERT − baseline): {_pct(test['f1'] - bl['f1'], 2)}")

    if mcn:
        lines.extend(
            [
                "",
                "### Hypothesis tests (test split)",
                "",
                f"- McNemar: b = {mcn.get('discordant_b')}, c = {mcn.get('discordant_c')}, "
                f"p = {mcn.get('p_value', 0):.4f} "
                f"({'significant' if mcn.get('significant_005') else 'not significant'} at α = 0.05)",
            ]
        )
        if mcn.get("interpretation"):
            lines.append(f"- {mcn['interpretation']}")
    for metric in ("accuracy", "f1"):
        b = boot.get(metric)
        if not b:
            continue
        lines.append(
            f"- Bootstrap Δ{metric}: {b['mean_diff']:+.4f} "
            f"[{b['ci_low']:.4f}, {b['ci_high']:.4f}], p = {b['p_value_two_sided']:.4f}"
        )

    if not ht:
        lines.append("")
        lines.append("*Run `make hypothesis-tests` to populate hypothesis test rows.*")

    return "\n".join(line for line in lines if line is not None) + "\n"


def sync_version_line(text: str) -> str:
    ver = VERSION_FILE.read_text(encoding="utf-8").strip() if VERSION_FILE.is_file() else "2.0.0"
    return re.sub(
        r"^\*\*Version:\*\* [^·]+",
        f"**Version:** {ver}",
        text,
        count=1,
        flags=re.MULTILINE,
    )


def main():
    artifact = load_evaluation_artifact()
    if not artifact:
        raise SystemExit(f"Missing {ARTIFACTS_DIR / 'evaluation.json'} — run: make evaluate")

    if not DOC_PATH.is_file():
        raise SystemExit(f"Missing {DOC_PATH}")

    auto = build_auto_block(artifact)
    text = sync_version_line(DOC_PATH.read_text(encoding="utf-8"))

    if MARKER_START in text and MARKER_END in text:
        before = text.split(MARKER_START)[0]
        after = text.split(MARKER_END)[1]
        new_text = before + MARKER_START + "\n\n" + auto + MARKER_END + after
    else:
        new_text = text.rstrip() + "\n\n" + MARKER_START + "\n\n" + auto + MARKER_END + "\n"

    DOC_PATH.write_text(new_text, encoding="utf-8")
    print(f"Updated {DOC_PATH}")


if __name__ == "__main__":
    main()
