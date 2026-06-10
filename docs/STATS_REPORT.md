# Statistical Report — CineSentiment (IMDB Movie Reviews)

**Version:** 2.0.0 · **Primary split:** test (held-out 15%) · **Generated from:** `artifacts/results/evaluation.json`

This document is the printable statistics summary for coursework (môn Học Thống Kê). Live numbers also appear at **http://127.0.0.1:8000/summary.html** via `/api/stats-report`.

---

## 1. Research question

Can a fine-tuned **DistilBERT** classifier predict binary movie-review sentiment (Fresh vs Rotten) with statistically reportable performance on a **held-out test set**, and does it outperform a classical **TF-IDF + logistic regression** baseline?

---

## 2. Data and experimental protocol

| Item | Value |
|------|--------|
| Dataset | IMDB movie reviews (50k labeled) |
| Splits | **70% train / 15% validation / 15% test** (stratified, `random_state=42`) |
| Test set size | **n = 7,500** |
| Label balance | ~50% positive / 50% negative per split |
| Decision rule | Predict positive if **P(Fresh) ≥ 0.5** |
| Uncertainty | **Bootstrap 95% CI** — 500 resamples, percentile method |

Training uses **only the train split**. Validation supports threshold/metric monitoring. **Test metrics are reported once** as the primary evidence (no test-set tuning).

---

## 3. Primary results (DistilBERT, test split)

Point estimates at threshold 0.5. Intervals from bootstrap (500 draws).

| Metric | Point estimate | 95% CI (bootstrap) |
|--------|----------------|---------------------|
| **Accuracy** | 91.76% | 91.11% – 92.31% |
| **F1** | 91.80% | 91.14% – 92.41% |
| **Precision (PPV)** | 91.41% | 90.50% – 92.27% |
| **Recall (sensitivity)** | 92.19% | 91.27% – 93.02% |
| **ROC-AUC** | 97.35% | *(ranking metric; see Insights curve)* |
| **Average precision** | 97.22% | *(see PR curve on Insights)* |

### Confusion matrix (test, threshold 0.5)

|  | Pred Rotten | Pred Fresh |
|--|-------------|------------|
| **True Rotten** | TN = 3,425 | FP = 325 |
| **True Fresh** | FN = 293 | TP = 3,457 |

### Derived rates (from confusion matrix)

| Statistic | Value |
|-----------|-------|
| Sensitivity (TPR) | 92.19% |
| Specificity (TNR) | 91.33% |
| False positive rate | 8.67% |
| False negative rate | 7.81% |
| Balanced accuracy | 91.76% |
| Error rate | 8.24% |

---

## 4. Validation split (monitoring only)

| Metric | Value | 95% CI |
|--------|-------|--------|
| Accuracy | 91.96% | 91.33% – 92.61% |
| F1 | 92.03% | 91.38% – 92.68% |

Validation and test results are **consistent** (no large gap), suggesting limited overfitting to the validation set.

---

## 5. Baseline comparison (TF-IDF + logistic regression)

Run `make baseline` and re-run `make evaluate` to refresh baseline rows in `evaluation.json`. Then compare on the **same test split**:

- **Δ metric = DistilBERT − TF-IDF** (point estimate)
- Report whether DistilBERT improves F1 / ROC-AUC in the direction expected for transfer learning on text

Interpretation for statistics class: the baseline is a **nested, pre-registered comparator** on identical labels and splits—not a post-hoc cherry-picked model.

### Formal hypothesis tests (test split, τ = 0.5)

Run `make hypothesis-tests` after baseline + evaluate. Results appear on **Statistics** (`/summary.html`) and in `evaluation.json` → `hypothesis_tests.test`.

| Test | Null hypothesis | Report |
|------|-----------------|--------|
| **McNemar** | Equal paired error rates between models | χ² (continuity correction), p-value, discordant counts *b* / *c* |
| **Bootstrap difference** | Mean metric difference (DistilBERT − TF-IDF) = 0 | Mean Δ, 95% bootstrap CI, two-sided p-value for **accuracy** and **F1** |

Use α = 0.05. McNemar addresses **whether error patterns differ**; bootstrap difference addresses **magnitude of metric improvement** with resampling uncertainty.

---

## 6. Probabilistic evaluation (calibration)

Report on **Insights** (`/insights.html`) or `/api/calibration-curve?split=test`:

- **Reliability diagram** — mean predicted P(Fresh) vs observed positive rate per bin
- **Brier score** — mean squared error of probabilities (lower is better)
- **ECE** — expected calibration error (lower is better)

Well-calibrated models lie near the diagonal; miscalibration means confidence scores are not trustworthy even when accuracy is high.

---

## 7. Threshold-independent metrics

| Tool | Purpose |
|------|---------|
| **ROC curve + AUC** | Ranking quality across all thresholds |
| **PR curve + AP** | Performance when classes are balanced but cost asymmetry matters |
| **Threshold sweep** | Choose operating point (e.g. maximize F1) |

F1-optimal threshold on test (from saved curves) may differ slightly from 0.5—report both if discussing business trade-offs.

---

## 8. Error analysis (qualitative statistics)

- Export: `artifacts/results/error_analysis_test.csv`
- In-app viewer: Metrics → Error analysis (FP/FN samples)
- Use for discussion: **which linguistic patterns** drive false positives/negatives (sarcasm, mixed sentiment, short reviews)

---

<!-- AUTO_STATS_START -->

## Auto-generated results (from evaluation.json)

*Updated by `make sync-docs` — do not edit manually; regenerate after `make capstone`.*

### Primary test metrics (DistilBERT, τ = 0.5)

| Metric | Point | 95% CI |
|--------|-------|--------|
| **Accuracy** | 91.76% | 91.11% – 92.31% |
| **F1** | 91.80% | 91.14% – 92.41% |
| **Precision** | 91.41% | 90.50% – 92.27% |
| **Recall** | 92.19% | 91.27% – 93.02% |

### Baseline (TF-IDF + logistic, test)

- Accuracy: 91.24%
- F1: 91.33%
- ΔF1 (DistilBERT − baseline): 0.47%

### Hypothesis tests (test split)

- McNemar: b = 366, c = 327, p = 0.1489 (not significant at α = 0.05)
- b=366 (DistilBERT correct, baseline wrong), c=327 (baseline correct, DistilBERT wrong). p=0.1489 — not significant at α=0.05.
- Bootstrap Δaccuracy: +0.0050 [-0.0010, 0.0120], p = 0.1333
- Bootstrap Δf1: +0.0044 [-0.0021, 0.0102], p = 0.2267
<!-- AUTO_STATS_END -->

---

## 9. Limitations (for discussion section)

1. **Domain:** IMDB only; generalization to other review sources is not proven.
2. **Point estimates vs tests:** Bootstrap CIs quantify sampling uncertainty; **McNemar** and **bootstrap difference tests** (`make hypothesis-tests`) support formal comparison vs the TF-IDF baseline.
3. **Multiple comparisons:** Many metrics are correlated; lead with **test F1 + ROC-AUC** and use others as supporting evidence.
4. **Compute:** Live curve recomputation uses a subsample (≤1,500 rows) when artifacts are missing.

---

## 10. Reproducibility commands

```bash
make install
make capstone          # baseline → train → evaluate → error-analysis → insights-curves → hypothesis-tests
make insights-curves   # ROC / PR / calibration in artifact
make serve             # http://127.0.0.1:8000
```

**Pages for defense:** Statistics (`/summary.html`) · Metrics · Insights · Methodology (`docs/METHODOLOGY.md`)

---

*Numbers above reflect `evaluation.json` as of artifact generation. Regenerate after retraining.*
