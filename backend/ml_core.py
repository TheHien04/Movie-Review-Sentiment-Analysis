"""
ML utilities: model readiness, metrics (sklearn), bootstrap CIs, evaluation artifacts.
"""
from __future__ import annotations

import json
import math
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.calibration import calibration_curve

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_RAW_DIR = PROJECT_ROOT / "data" / "raw"
DATA_SAMPLES_DIR = PROJECT_ROOT / "data" / "samples"
ARTIFACTS_DIR = PROJECT_ROOT / "artifacts" / "results"
EVALUATION_JSON = ARTIFACTS_DIR / "evaluation.json"

WEIGHT_FILENAMES = ("pytorch_model.bin", "model.safetensors", "model.pt")


def predict_probs(model, tokenizer, texts, batch_size=32, max_length=256):
    """Run model inference and return P(positive) for each text."""
    import torch
    model.eval()
    all_probs = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        inputs = tokenizer(
            batch, padding=True, truncation=True, max_length=max_length, return_tensors="pt"
        )
        with torch.no_grad():
            logits = model(**inputs).logits
            probs = torch.softmax(logits, dim=1)[:, 1].cpu().numpy()
        all_probs.extend(probs)
    return np.array(all_probs)


def has_trained_weights(model_dir: os.PathLike | str) -> bool:
    path = Path(model_dir)
    return any((path / name).is_file() for name in WEIGHT_FILENAMES)


def resolve_data_path(env_var: str, default: Path) -> Path:
    override = os.getenv(env_var)
    return Path(override).resolve() if override else default.resolve()


def default_train_path() -> Path:
    return resolve_data_path("TRAIN_DATA_PATH", DATA_RAW_DIR / "train.csv")


def default_val_path() -> Path:
    return resolve_data_path("VAL_DATA_PATH", DATA_RAW_DIR / "val.csv")


def default_test_path() -> Path:
    return resolve_data_path("TEST_DATA_PATH", DATA_RAW_DIR / "test.csv")


def sanitize_for_json(obj: Any) -> Any:
    """Replace NaN/Inf so artifacts parse in browsers (strict JSON)."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, np.ndarray):
        return sanitize_for_json(obj.tolist())
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        f = float(obj)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    return obj


def load_evaluation_artifact() -> Optional[Dict[str, Any]]:
    if not EVALUATION_JSON.is_file():
        return None
    with open(EVALUATION_JSON, encoding="utf-8") as f:
        data = json.load(f)
    return sanitize_for_json(data)


def save_evaluation_artifact(report: Dict[str, Any]) -> Path:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    clean = sanitize_for_json(report)
    with open(EVALUATION_JSON, "w", encoding="utf-8") as f:
        json.dump(clean, f, indent=2, allow_nan=False)
    return EVALUATION_JSON


def compute_classification_metrics(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Binary metrics on held-out labels; P(positive) compared to threshold."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    y_pred = (y_prob >= threshold).astype(int)

    metrics: Dict[str, Any] = {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "label_distribution": [int(np.sum(y_true == 0)), int(np.sum(y_true == 1))],
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=[0, 1]).tolist(),
        "threshold": float(threshold),
        "n_samples": int(len(y_true)),
    }

    if len(np.unique(y_true)) > 1:
        metrics["roc_auc"] = float(roc_auc_score(y_true, y_prob))
        metrics["average_precision"] = float(average_precision_score(y_true, y_prob))

    return metrics


def threshold_curve_points(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    thresholds: Optional[np.ndarray] = None,
) -> List[Dict[str, float]]:
    """Precision/recall/F1 across decision thresholds (for UI charts)."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    if thresholds is None:
        thresholds = np.linspace(0.1, 0.9, 17)
    points: List[Dict[str, float]] = []
    for t in thresholds:
        m = compute_classification_metrics(y_true, y_prob, float(t))
        points.append(
            {
                "threshold": float(t),
                "accuracy": m["accuracy"],
                "precision": m["precision"],
                "recall": m["recall"],
                "f1": m["f1"],
            }
        )
    return points


def roc_curve_points(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    max_points: int = 80,
) -> Dict[str, Any]:
    """ROC curve coordinates for Chart.js line plot."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    if len(np.unique(y_true)) < 2:
        return {"fpr": [], "tpr": [], "thresholds": [], "auc": None}
    fpr, tpr, thr = roc_curve(y_true, y_prob)
    auc = float(roc_auc_score(y_true, y_prob))
    if len(fpr) > max_points:
        idx = np.linspace(0, len(fpr) - 1, max_points).astype(int)
        fpr, tpr, thr = fpr[idx], tpr[idx], thr[idx]
    return {
        "fpr": [float(x) for x in fpr],
        "tpr": [float(x) for x in tpr],
        "thresholds": [float(x) for x in thr],
        "auc": auc,
    }


def bootstrap_metric_cis(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    threshold: float = 0.5,
    n_bootstrap: int = 500,
    seed: int = 42,
) -> Dict[str, Dict[str, float]]:
    """Percentile bootstrap 95% CIs for key classification metrics."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    n = len(y_true)
    if n < 10:
        return {}

    rng = np.random.default_rng(seed)
    keys = ("accuracy", "f1", "precision", "recall")
    samples = {k: [] for k in keys}

    for _ in range(n_bootstrap):
        idx = rng.integers(0, n, n)
        yt = y_true[idx]
        yp = y_prob[idx]
        m = compute_classification_metrics(yt, yp, threshold)
        for k in keys:
            samples[k].append(m[k])

    cis: Dict[str, Dict[str, float]] = {}
    for k, vals in samples.items():
        arr = np.asarray(vals)
        cis[k] = {
            "low": float(np.percentile(arr, 2.5)),
            "high": float(np.percentile(arr, 97.5)),
            "mean": float(np.mean(arr)),
        }
    return cis


def derived_classification_stats(confusion_matrix: List[List[int]]) -> Dict[str, float]:
    """Sensitivity, specificity, error rate, and related rates from 2×2 CM (labels 0=Rotten, 1=Fresh)."""
    cm = np.asarray(confusion_matrix, dtype=int)
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])
    n = tn + fp + fn + tp
    if n <= 0:
        return {}
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    return {
        "true_negatives": tn,
        "false_positives": fp,
        "false_negatives": fn,
        "true_positives": tp,
        "n_samples": n,
        "sensitivity": float(sensitivity),
        "specificity": float(specificity),
        "recall_positive": float(sensitivity),
        "error_rate": float((fp + fn) / n),
        "false_positive_rate": float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0,
        "false_negative_rate": float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0,
        "balanced_accuracy": float((sensitivity + specificity) / 2.0),
        "positive_predictive_value": float(tp / (tp + fp)) if (tp + fp) > 0 else 0.0,
        "negative_predictive_value": float(tn / (tn + fn)) if (tn + fn) > 0 else 0.0,
    }


def pr_curve_points(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    max_points: int = 80,
) -> Dict[str, Any]:
    """Precision–recall curve coordinates for Chart.js."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    if len(np.unique(y_true)) < 2:
        return {"precision": [], "recall": [], "average_precision": None}
    precision, recall, _ = precision_recall_curve(y_true, y_prob)
    ap = float(average_precision_score(y_true, y_prob))
    if len(precision) > max_points:
        idx = np.linspace(0, len(precision) - 1, max_points).astype(int)
        precision, recall = precision[idx], recall[idx]
    return {
        "precision": [float(x) for x in precision],
        "recall": [float(x) for x in recall],
        "average_precision": ap,
    }


def optimal_threshold_from_curve(
    threshold_points: List[Dict[str, float]],
) -> Optional[Dict[str, float]]:
    """Threshold that maximizes F1 on a precomputed threshold sweep."""
    if not threshold_points:
        return None
    best = max(threshold_points, key=lambda p: p.get("f1", 0.0))
    return {
        "threshold": float(best.get("threshold", 0.5)),
        "f1": float(best.get("f1", 0.0)),
        "precision": float(best.get("precision", 0.0)),
        "recall": float(best.get("recall", 0.0)),
        "accuracy": float(best.get("accuracy", 0.0)),
    }


def mcnemar_test(
    y_true: np.ndarray,
    pred_a: np.ndarray,
    pred_b: np.ndarray,
) -> Dict[str, Any]:
    """
    McNemar test for paired classifier errors on the same labeled samples.
    Uses continuity-corrected chi-square (df=1); exact binomial if scipy unavailable.
    """
    y_true = np.asarray(y_true, dtype=int)
    pred_a = np.asarray(pred_a, dtype=int)
    pred_b = np.asarray(pred_b, dtype=int)
    correct_a = pred_a == y_true
    correct_b = pred_b == y_true
    b = int(np.sum(correct_a & ~correct_b))
    c = int(np.sum(~correct_a & correct_b))
    n_discordant = b + c
    if n_discordant == 0:
        return {
            "discordant_b": b,
            "discordant_c": c,
            "n_discordant": 0,
            "statistic": 0.0,
            "p_value": 1.0,
            "significant_005": False,
            "interpretation": "No discordant pairs — models agree on every sample.",
        }
    statistic = float((abs(b - c) - 1) ** 2 / n_discordant)
    try:
        from scipy.stats import chi2

        p_value = float(chi2.sf(statistic, df=1))
        method = "chi-square continuity correction (df=1)"
    except ImportError:
        from math import comb

        k = min(b, c)
        p_one = sum(comb(n_discordant, i) for i in range(k + 1)) / (2**n_discordant)
        p_value = float(min(1.0, 2.0 * p_one))
        method = "exact binomial (two-sided)"
    significant = p_value < 0.05
    winner = "distilbert" if b > c else "tfidf_logistic" if c > b else "tie"
    return {
        "discordant_b": b,
        "discordant_c": c,
        "n_discordant": n_discordant,
        "statistic": statistic,
        "p_value": p_value,
        "significant_005": significant,
        "method": method,
        "favors": winner,
        "interpretation": (
            f"b={b} (DistilBERT correct, baseline wrong), c={c} (baseline correct, DistilBERT wrong). "
            f"p={p_value:.4g} — {'significant' if significant else 'not significant'} at α=0.05."
        ),
    }


def bootstrap_metric_difference(
    y_true: np.ndarray,
    prob_a: np.ndarray,
    prob_b: np.ndarray,
    threshold: float = 0.5,
    metrics: Tuple[str, ...] = ("accuracy", "f1"),
    n_bootstrap: int = 500,
    seed: int = 42,
) -> Dict[str, Dict[str, Any]]:
    """Bootstrap 95% CI and two-sided p-value for metric differences (A − B)."""
    y_true = np.asarray(y_true, dtype=int)
    prob_a = np.asarray(prob_a, dtype=float)
    prob_b = np.asarray(prob_b, dtype=float)
    n = len(y_true)
    if n < 10:
        return {}

    rng = np.random.default_rng(seed)
    out: Dict[str, Dict[str, Any]] = {}
    for metric in metrics:
        diffs: List[float] = []
        for _ in range(n_bootstrap):
            idx = rng.integers(0, n, n)
            yt = y_true[idx]
            ma = compute_classification_metrics(yt, prob_a[idx], threshold)
            mb = compute_classification_metrics(yt, prob_b[idx], threshold)
            diffs.append(float(ma[metric]) - float(mb[metric]))
        arr = np.asarray(diffs)
        p_one = float(np.mean(arr <= 0))
        p_two = float(min(1.0, 2.0 * min(p_one, 1.0 - p_one)))
        out[metric] = {
            "mean_diff": float(np.mean(arr)),
            "ci_low": float(np.percentile(arr, 2.5)),
            "ci_high": float(np.percentile(arr, 97.5)),
            "p_value_two_sided": p_two,
            "significant_005": p_two < 0.05,
            "interpretation": "Δ = DistilBERT − TF-IDF on bootstrap resamples",
        }
    return out


def cohens_h(p1: float, p2: float) -> float:
    """Cohen's h effect size for two proportions (arcsine difference)."""
    p1 = float(np.clip(p1, 0.0, 1.0))
    p2 = float(np.clip(p2, 0.0, 1.0))
    return float(2.0 * (np.arcsin(np.sqrt(p1)) - np.arcsin(np.sqrt(p2))))


def _cohens_h_magnitude(h: float) -> str:
    a = abs(h)
    if a < 0.2:
        return "negligible"
    if a < 0.5:
        return "small"
    if a < 0.8:
        return "medium"
    return "large"


def classification_effect_sizes(
    y_true: np.ndarray,
    prob_a: np.ndarray,
    prob_b: np.ndarray,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Effect sizes for paired classifiers: Cohen's h on accuracy, odds ratio from discordant pairs."""
    y_true = np.asarray(y_true, dtype=int)
    prob_a = np.asarray(prob_a, dtype=float)
    prob_b = np.asarray(prob_b, dtype=float)
    pred_a = (prob_a >= threshold).astype(int)
    pred_b = (prob_b >= threshold).astype(int)
    acc_a = float(np.mean(pred_a == y_true))
    acc_b = float(np.mean(pred_b == y_true))
    h_acc = cohens_h(acc_a, acc_b)
    correct_a = pred_a == y_true
    correct_b = pred_b == y_true
    b = int(np.sum(correct_a & ~correct_b))
    c = int(np.sum(~correct_a & correct_b))
    if c == 0:
        odds_ratio = float("inf") if b > 0 else 1.0
    else:
        odds_ratio = float(b / c)
    return {
        "accuracy_primary": acc_a,
        "accuracy_baseline": acc_b,
        "cohens_h_accuracy": h_acc,
        "cohens_h_magnitude": _cohens_h_magnitude(h_acc),
        "discordant_b": b,
        "discordant_c": c,
        "odds_ratio_discordant": odds_ratio,
        "interpretation": (
            f"Cohen's h={h_acc:.3f} ({_cohens_h_magnitude(h_acc)}); "
            f"odds ratio (b/c)={odds_ratio:.3f} for paired errors."
        ),
    }


def bonferroni_correction(
    p_values: Dict[str, float],
    alpha: float = 0.05,
) -> Dict[str, Any]:
    """Bonferroni-adjusted significance across multiple hypothesis tests."""
    if not p_values:
        return {"alpha": alpha, "n_tests": 0, "adjusted_alpha": alpha, "results": {}}
    n = len(p_values)
    adj = alpha / n
    results = {}
    for name, p in p_values.items():
        p = float(p)
        results[name] = {
            "p_value": p,
            "adjusted_alpha": adj,
            "significant_bonferroni": p < adj,
        }
    return {
        "alpha": alpha,
        "n_tests": n,
        "adjusted_alpha": adj,
        "method": "Bonferroni",
        "results": results,
    }


def summarize_hypothesis_block(
    block: Dict[str, Any],
    baseline_label: str = "TF-IDF logistic",
) -> Dict[str, str]:
    """
    Plain-language takeaway for UI and reports.
    Does not alter test results — explains statistical vs practical significance.
    """
    mcnemar = block.get("mcnemar") or {}
    effect = block.get("effect_sizes") or {}
    boot = block.get("bootstrap_difference") or {}
    acc_boot = boot.get("accuracy") or {}

    p_val = mcnemar.get("p_value")
    sig = mcnemar.get("significant_005")
    h = effect.get("cohens_h_accuracy")
    mag = effect.get("cohens_h_magnitude") or "negligible"
    b = mcnemar.get("discordant_b")
    c = mcnemar.get("discordant_c")
    mean_diff = acc_boot.get("mean_diff")

    if sig:
        headline = (
            f"DistilBERT differs significantly from {baseline_label} on paired errors (α = 0.05)."
        )
    else:
        headline = (
            f"No statistically significant difference vs {baseline_label} at α = 0.05 — "
            "both models perform similarly on this held-out test set."
        )

    details: List[str] = []
    if isinstance(mean_diff, (int, float)):
        ci_lo = acc_boot.get("ci_low")
        ci_hi = acc_boot.get("ci_high")
        ci_txt = ""
        if isinstance(ci_lo, (int, float)) and isinstance(ci_hi, (int, float)):
            ci_txt = f" (95% CI: {ci_lo:+.2%} to {ci_hi:+.2%})"
        details.append(
            f"Point estimate: DistilBERT is {mean_diff:+.2%} more accurate{ci_txt}. "
            "A positive Δ does not imply significance — the CI must exclude zero."
        )
    if isinstance(h, (int, float)):
        details.append(f"Effect size Cohen's h = {h:.3f} ({mag}) — the practical gap is small.")
    if b is not None and c is not None and p_val is not None:
        details.append(
            f"McNemar discordant pairs: b = {b} (DistilBERT wins), c = {c} (baseline wins), p = {p_val:.4g}."
        )

    defense = (
        "For client briefings: report point estimates and CIs transparently. "
        "A strong TF-IDF logistic baseline near 91% accuracy limits power to detect a ~0.5% gain. "
        "Emphasize significant wins vs weaker baselines, error analysis, and interpretability."
    )

    return {
        "headline": headline,
        "detail": " ".join(details),
        "defense_note": defense,
        "null_hypothesis": (
            "H₀: DistilBERT and the baseline make the same proportion of errors on paired test samples."
        ),
    }


def summarize_hypothesis_report(report: Dict[str, Any]) -> Dict[str, str]:
    """Report-level takeaway across all baseline comparisons."""
    comparisons = report.get("comparisons") or {}
    sig_baselines = []
    for name, block in comparisons.items():
        m = (block or {}).get("mcnemar") or {}
        if m.get("significant_005"):
            sig_baselines.append(name.replace("_", " "))

    primary = comparisons.get("tfidf_logistic") or {}
    takeaway = summarize_hypothesis_block(primary, baseline_label="TF-IDF logistic")

    if sig_baselines:
        takeaway["headline"] += (
            f" Significant differences were detected vs: {', '.join(sig_baselines)}."
        )
    return takeaway


def compare_classifiers_hypothesis(
    y_true: np.ndarray,
    prob_distilbert: np.ndarray,
    prob_baseline: np.ndarray,
    threshold: float = 0.5,
    split: str = "test",
    n_bootstrap: int = 500,
    seed: int = 42,
    baseline_name: str = "tfidf_logistic",
) -> Dict[str, Any]:
    """McNemar + bootstrap difference tests for DistilBERT vs a baseline on one split."""
    y_true = np.asarray(y_true, dtype=int)
    prob_distilbert = np.asarray(prob_distilbert, dtype=float)
    prob_baseline = np.asarray(prob_baseline, dtype=float)
    pred_bert = (prob_distilbert >= threshold).astype(int)
    pred_bl = (prob_baseline >= threshold).astype(int)
    mcnemar = mcnemar_test(y_true, pred_bert, pred_bl)
    bootstrap_diff = bootstrap_metric_difference(
        y_true,
        prob_distilbert,
        prob_baseline,
        threshold=threshold,
        metrics=("accuracy", "f1"),
        n_bootstrap=n_bootstrap,
        seed=seed,
    )
    for block in bootstrap_diff.values():
        block["interpretation"] = (
            f"Δ = distilbert − {baseline_name} on bootstrap resamples"
        )
    effect_sizes = classification_effect_sizes(
        y_true, prob_distilbert, prob_baseline, threshold=threshold
    )
    return {
        "split": split,
        "threshold": threshold,
        "n_samples": int(len(y_true)),
        "models": {"primary": "distilbert", "baseline": baseline_name},
        "mcnemar": mcnemar,
        "bootstrap_difference": bootstrap_diff,
        "effect_sizes": effect_sizes,
        "alpha": 0.05,
        "n_bootstrap": n_bootstrap,
        "seed": seed,
    }


def metric_deltas(primary: Dict[str, Any], baseline: Dict[str, Any]) -> Dict[str, Optional[float]]:
    """Point estimate deltas (primary − baseline) for headline metrics."""
    keys = ("accuracy", "f1", "precision", "recall", "roc_auc", "average_precision")
    out: Dict[str, Optional[float]] = {}
    for k in keys:
        a, b = primary.get(k), baseline.get(k)
        out[k] = float(a - b) if isinstance(a, (int, float)) and isinstance(b, (int, float)) else None
    return out


def expected_calibration_error(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    n_bins: int = 10,
) -> float:
    """Expected Calibration Error (ECE) for probabilistic classifiers."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    n = len(y_true)
    if n <= 0:
        return 0.0
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        if i < n_bins - 1:
            mask = (y_prob >= lo) & (y_prob < hi)
        else:
            mask = (y_prob >= lo) & (y_prob <= hi)
        if not np.any(mask):
            continue
        acc = float(np.mean(y_true[mask]))
        conf = float(np.mean(y_prob[mask]))
        ece += float(np.sum(mask)) / n * abs(acc - conf)
    return float(ece)


def calibration_curve_points(
    y_true: np.ndarray,
    y_prob_positive: np.ndarray,
    n_bins: int = 10,
) -> Dict[str, Any]:
    """Reliability diagram coordinates + Brier score and ECE."""
    y_true = np.asarray(y_true, dtype=int)
    y_prob = np.asarray(y_prob_positive, dtype=float)
    if len(y_true) == 0:
        return {
            "mean_predicted": [],
            "fraction_positive": [],
            "brier_score": None,
            "ece": None,
            "n_bins": n_bins,
        }
    brier = float(brier_score_loss(y_true, y_prob))
    ece = expected_calibration_error(y_true, y_prob, n_bins=n_bins)
    if len(np.unique(y_true)) < 2:
        return {
            "mean_predicted": [],
            "fraction_positive": [],
            "brier_score": brier,
            "ece": ece,
            "n_bins": n_bins,
        }
    frac_pos, mean_pred = calibration_curve(
        y_true, y_prob, n_bins=n_bins, strategy="uniform"
    )
    return {
        "mean_predicted": [float(x) for x in mean_pred],
        "fraction_positive": [float(x) for x in frac_pos],
        "brier_score": brier,
        "ece": ece,
        "n_bins": n_bins,
    }


def build_stats_report(artifact: Dict[str, Any]) -> Dict[str, Any]:
    """Coursework stats summary from evaluation artifact (test split primary)."""
    if not artifact or "splits" not in artifact:
        return {"error": "No evaluation artifact"}

    report: Dict[str, Any] = {
        "generated_at": artifact.get("generated_at"),
        "methodology": artifact.get("methodology"),
        "training": artifact.get("training"),
        "protocol": {
            "task": "binary_sentiment",
            "splits": "70% train / 15% val / 15% test (stratified, seed=42)",
            "decision_threshold": 0.5,
            "bootstrap": "500 resamples, percentile 95% CI",
            "primary_report_split": "test",
        },
        "splits": {},
        "model_comparison": None,
        "calibration": artifact.get("calibration", {}),
    }

    for split_name in ("val", "test"):
        block = artifact.get("splits", {}).get(split_name)
        if not block:
            continue
        m = block.get("metrics", {})
        report["splits"][split_name] = {
            "n_samples": block.get("n_samples") or m.get("n_samples"),
            "metrics": {
                k: m.get(k)
                for k in (
                    "accuracy",
                    "f1",
                    "precision",
                    "recall",
                    "roc_auc",
                    "average_precision",
                )
                if m.get(k) is not None
            },
            "confidence_intervals": m.get("confidence_intervals"),
            "confusion_matrix": m.get("confusion_matrix"),
        }
        if m.get("confusion_matrix"):
            report["splits"][split_name]["derived"] = derived_classification_stats(
                m["confusion_matrix"]
            )

    bert_test = artifact.get("splits", {}).get("test", {}).get("metrics", {})
    baseline = artifact.get("baselines", {}).get("tfidf_logistic", {})
    bl_test = baseline.get("splits", {}).get("test", {}).get("metrics", {})
    if bert_test and bl_test:
        report["model_comparison"] = {
            "split": "test",
            "distilbert": {
                k: bert_test.get(k)
                for k in ("accuracy", "f1", "precision", "recall", "roc_auc", "average_precision")
            },
            "tfidf_logistic": {
                k: bl_test.get(k)
                for k in ("accuracy", "f1", "precision", "recall", "roc_auc", "average_precision")
            },
            "deltas": metric_deltas(bert_test, bl_test),
            "interpretation": "Δ = DistilBERT − TF-IDF on test split (point estimate). See hypothesis tests for formal comparison.",
        }

    if artifact.get("hypothesis_tests"):
        report["hypothesis_tests"] = artifact["hypothesis_tests"]

    curves_test = artifact.get("curves", {}).get("test", {})
    thr = curves_test.get("threshold_curve") or []
    if thr:
        report["optimal_threshold_test"] = optimal_threshold_from_curve(thr)

    return report


def split_review_sentences(text: str, max_sentences: int = 14) -> List[str]:
    """Split review into sentences for per-sentence sentiment arc (no retraining)."""
    if not text or not str(text).strip():
        return []
    cleaned = re.sub(r"\s+", " ", str(text).strip())
    parts = re.split(r"(?<=[.!?…])\s+|\n+", cleaned)
    sentences = [s.strip() for s in parts if s.strip() and len(s.strip()) > 2]
    if len(sentences) <= 1 and ";" in cleaned:
        sentences = [s.strip() for s in cleaned.split(";") if s.strip()]
    return sentences[:max_sentences]


def format_single_prediction(label: int, prob_positive: float, prob_negative: float) -> Dict[str, Any]:
    prob_positive = float(prob_positive)
    prob_negative = float(prob_negative)
    confidence = prob_positive if label == 1 else prob_negative
    return {
        "label": int(label),
        "probability": prob_positive,
        "probability_positive": prob_positive,
        "probability_negative": prob_negative,
        "confidence": float(confidence),
        "sentiment": "positive" if label == 1 else "negative",
    }


def read_labeled_csv(path: Path, max_rows: Optional[int] = None) -> Tuple[List[str], np.ndarray]:
    df = pd.read_csv(path, nrows=max_rows)
    if "text" not in df.columns or "label" not in df.columns:
        raise ValueError(f'CSV must contain "text" and "label" columns: {path}')
    texts = df["text"].astype(str).tolist()
    labels = df["label"].astype(int).values
    return texts, labels


def _count_csv_rows(path: Path) -> int:
    """Fast row count without loading full text into memory."""
    if not path.is_file():
        return 0
    with open(path, "rb") as f:
        return max(0, sum(1 for _ in f) - 1)


def dataset_summary(train_path: Path, val_path: Path, test_path: Path) -> Dict[str, Any]:
    train_count = _count_csv_rows(train_path)
    val_count = _count_csv_rows(val_path)
    test_count = _count_csv_rows(test_path)

    train_labels = pd.read_csv(train_path, usecols=["label"])
    train_preview = pd.read_csv(train_path, usecols=["text", "label"], nrows=8000)
    rotten = int((train_labels["label"] == 0).sum())
    fresh = int((train_labels["label"] == 1).sum())
    stats = {
        "Total samples (all splits)": train_count + val_count + test_count,
        "Training split": train_count,
        "Validation split": val_count,
        "Test split": test_count,
        "Fresh (train only)": fresh,
        "Rotten (train only)": rotten,
        "Avg. review length (chars, train)": int(
            train_preview["text"].astype(str).str.len().mean()
        ),
        # Legacy keys used by older frontend chart code
        "Negative": rotten,
        "Positive": fresh,
    }
    label_counts = {"negative": rotten, "positive": fresh}
    statistics = {
        "total_samples": train_count + val_count + test_count,
        "train_samples": train_count,
        "val_samples": val_count,
        "test_samples": test_count,
    }
    n_sample = min(5, len(train_preview))
    samples = (
        train_preview.sample(n=n_sample, random_state=42)[["text", "label"]].to_dict(
            orient="records"
        )
        if n_sample
        else []
    )
    return {
        "stats": stats,
        "samples": samples,
        "statistics": statistics,
        "label_counts": label_counts,
        "data_source": "measured",
    }


def capstone_readiness(project_root: Optional[Path] = None) -> Dict[str, Any]:
    """Checklist for capstone / statistics defense readiness (artifacts + docs)."""
    root = project_root or PROJECT_ROOT
    artifact = load_evaluation_artifact()
    model_dir = root / "sentiment_model"

    def _check(
        check_id: str,
        label: str,
        ok: bool,
        hint: str = "",
        required: bool = True,
    ) -> Dict[str, Any]:
        return {
            "id": check_id,
            "label": label,
            "ok": bool(ok),
            "hint": hint,
            "required": required,
        }

    test_block = (artifact or {}).get("splits", {}).get("test", {})
    test_metrics = test_block.get("metrics", {})
    baselines = (artifact or {}).get("baselines", {})
    hypothesis = (artifact or {}).get("hypothesis_tests", {}).get("test", {})

    insights_path = ARTIFACTS_DIR / "insights_curves.json"
    insights_ok = False
    if insights_path.is_file():
        try:
            ic = json.loads(insights_path.read_text(encoding="utf-8"))
            test_curves = ic.get("splits", {}).get("test", {})
            insights_ok = "calibration_curve" in test_curves
        except (json.JSONDecodeError, OSError):
            insights_ok = False

    items = [
        _check(
            "model_weights",
            "Fine-tuned model weights (sentiment_model/)",
            has_trained_weights(model_dir),
            "make train",
        ),
        _check(
            "evaluation_json",
            "Evaluation artifact (evaluation.json)",
            EVALUATION_JSON.is_file(),
            "make evaluate",
        ),
        _check(
            "test_metrics",
            "Held-out test split metrics",
            bool(test_metrics.get("accuracy") is not None),
            "make evaluate",
        ),
        _check(
            "bootstrap_ci",
            "Bootstrap 95% CI on test metrics",
            bool(test_metrics.get("confidence_intervals")),
            "make evaluate",
        ),
        _check(
            "tfidf_baseline",
            "TF-IDF baseline in evaluation.json",
            "tfidf_logistic" in baselines,
            "make baseline",
        ),
        _check(
            "hypothesis_tests",
            "Hypothesis tests (McNemar + bootstrap Δ)",
            bool(hypothesis.get("mcnemar")),
            "make hypothesis-tests",
        ),
        _check(
            "error_csv",
            "Error analysis export (test FP/FN)",
            (ARTIFACTS_DIR / "error_analysis_test.csv").is_file(),
            "make error-analysis",
        ),
        _check(
            "insights_curves",
            "ROC / PR / calibration curves artifact",
            insights_ok,
            "make insights-curves",
        ),
        _check(
            "calibration_bundle",
            "Frontend calibration fallback bundle",
            (root / "frontend" / "data" / "calibration-data.js").is_file(),
            "make insights-curves",
        ),
        _check(
            "eda_notebook",
            "EDA notebook for báo cáo",
            (root / "notebooks" / "01_eda_imdb.ipynb").is_file(),
            "Open notebooks/01_eda_imdb.ipynb",
        ),
        _check(
            "methodology_doc",
            "Methodology documentation",
            (root / "docs" / "METHODOLOGY.md").is_file(),
            "",
            required=False,
        ),
        _check(
            "demo_script",
            "Defense demo script",
            (root / "docs" / "DEMO_SCRIPT.md").is_file(),
            "",
            required=False,
        ),
    ]

    required_items = [i for i in items if i.get("required", True)]
    passed_required = sum(1 for i in required_items if i["ok"])
    total_required = len(required_items)
    all_required_ok = passed_required == total_required

    summary_line = None
    if test_metrics:
        acc = test_metrics.get("accuracy")
        f1 = test_metrics.get("f1")
        if acc is not None and f1 is not None:
            summary_line = f"Test: accuracy {acc * 100:.2f}%, F1 {f1 * 100:.2f}%"

    return {
        "ready": all_required_ok,
        "passed": passed_required,
        "total": total_required,
        "score_label": f"{passed_required}/{total_required}",
        "items": items,
        "test_summary": summary_line,
        "hypothesis_summary": hypothesis.get("mcnemar", {}).get("interpretation"),
        "pipeline": "make capstone",
    }
