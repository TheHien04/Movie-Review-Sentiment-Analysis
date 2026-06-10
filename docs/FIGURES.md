# Figure Catalog — UI Screenshots for Reports and Reviews

**Project:** CineSentiment — IMDB movie review sentiment classification  
**Model:** Fine-tuned DistilBERT; baseline TF-IDF + logistic regression  
**System version:** 2.3.0

This document provides academic-style captions for each screenshot in `Images/`. Use these when writing papers, capstone reports, or design reviews. **Authoritative test-split numbers** are in [STATS_REPORT.md](STATS_REPORT.md); UI screenshots may show validation split or rounded display values.

---

## Figure 1 — Landing page: model performance summary

**File:** `Images/home-landing-hero.jpg`

The landing view states the binary classification task (Fresh vs Rotten) and surfaces aggregate performance indicators loaded from `evaluation.json` (approximately 91.8% accuracy/F1, 97.3% ROC-AUC on the monitored split). This is a stakeholder-facing summary; formal reporting should cite **test-split** metrics from Section 3 of the stats report.

**Suggested caption:** *Figure 1. CineSentiment landing page summarizing DistilBERT performance on IMDB reviews.*

---

## Figure 2 — Landing page: product workflows

**File:** `Images/home-workflows.jpg`

The *Example Output* panel shows illustrative predictions with confidence. The *Built for Real Workflows* grid documents system capabilities: single and batch inference, explainable AI, A/B comparison, REST API, live draft preview, sentence-level tone arc, and aspect-based sentiment. This is the functional map of the web layer over the trained ML pipeline.

**Suggested caption:** *Figure 2. End-to-end workflows from input to API integration.*

---

## Figure 3 — Single-review analysis with live draft inference

**File:** `Images/analyze-single-review.jpg`

The Analyze page accepts free text. The *Live Draft* panel updates label and P(Fresh) during typing, demonstrating low-latency inference. *Rate this review* triggers the full pipeline: classification, gradient-based word attribution, tone arc, and optional aspect scores.

**Suggested caption:** *Figure 3. Single-review interface with real-time draft inference.*

---

## Figure 4 — Batch CSV inference

**File:** `Images/analyze-batch-csv.jpg`

Users upload a CSV with a text column; the system runs batch inference and renders a results table (review, verdict, confidence). Optional Server-Sent Events (SSE) report progress for long jobs. Supports throughput testing and regression checks on sample files such as `train_small.csv`.

**Suggested caption:** *Figure 4. Batch classification via CSV upload and tabular results.*

---

## Figure 5 — Voice input (speech-to-text)

**File:** `Images/analyze-voice-input.jpg`

The Web Speech API captures audio, displays a waveform, and transcribes speech into the review textarea before standard NLP inference. Demonstrates multimodal input at the presentation layer.

**Suggested caption:** *Figure 5. Voice-to-text input preceding sentiment classification.*

---

## Figure 6 — Side-by-side review comparison with explainability

**File:** `Images/compare-side-by-side.jpg`

Two reviews are scored independently. Each panel shows predicted label, confidence, and *top drivers* (input × gradient attribution per token). Used to compare rival critic takes or A/B copy under identical model settings.

**Suggested caption:** *Figure 6. Paired review comparison with token-level attribution.*

---

## Figure 7 — Comparison visualizations

**File:** `Images/compare-charts.jpg`

Bar and donut charts compare P(Fresh) across Review A and Review B. A text summary states when sentiments are opposed (e.g., Fresh vs Rotten).

**Suggested caption:** *Figure 7. Confidence visualization for dual-review comparison.*

---

## Figure 8 — Dataset split overview

**File:** `Images/metrics-dataset-overview.jpg`

The Model Accuracy dashboard documents the experimental protocol: IMDB 50k reviews, **70% / 15% / 15%** stratified split (`random_state=42`). The bar chart shows |train| = 35,000, |val| = |test| = 7,500.

**Suggested caption:** *Figure 8. Stratified train, validation, and test partition sizes.*

---

## Figure 9 — Model comparison and qualitative error analysis

**File:** `Images/metrics-model-comparison.jpg`

Table comparing **DistilBERT (fine-tuned)** vs **TF-IDF + logistic regression** on the selected split, with **95% bootstrap confidence intervals** and point-estimate deltas (percentage points). The error-analysis section lists sample false positives and false negatives for qualitative review (30 rows in UI; full export via CSV).

**Suggested caption:** *Figure 9. DistilBERT vs classical baseline with bootstrap CIs and error samples.*

---

## Figure 10 — Validation metrics and derived contingency rates

**File:** `Images/metrics-validation-summary.jpg`

Metric cards (accuracy, F1, precision, recall, ROC-AUC, average precision) on the **validation** split with bootstrap CIs where available. The statistical summary block reports sensitivity, specificity, FPR, FNR, PPV, NPV, and balanced accuracy derived from the confusion matrix.

**Suggested caption:** *Figure 10. Validation-split metrics and confusion-matrix-derived rates.*

---

## Figure 11 — Confusion matrix, class balance, and metric bars

**File:** `Images/metrics-confusion-label-bars.jpg`

Three panels: (1) 2×2 confusion matrix on validation; (2) donut chart showing ~50/50 class balance; (3) bar chart comparing accuracy, F1, precision, recall, and ROC-AUC on a 0–100% scale.

**Suggested caption:** *Figure 11. Confusion matrix, label balance, and multi-metric comparison.*

---

## Figure 12 — Metrics detail modal

**File:** `Images/metrics-detail-modal.jpg`

Modal dialog listing accuracy, F1, precision, recall, and ROC-AUC for validation at threshold 0.5, with a 95% CI column (bootstrap, 500 resamples, percentile method).

**Suggested caption:** *Figure 12. Detailed classification metrics with bootstrap confidence intervals.*

---

## Figure 13 — Confusion matrix detail modal

**File:** `Images/metrics-confusion-modal.jpg`

Validation confusion counts: TN = 3,415, FP = 335, FN = 268, TP = 3,482 (n = 7,500). Reports sensitivity 92.85%, specificity 91.07%, balanced accuracy 91.96%.

**Suggested caption:** *Figure 13. Confusion matrix and TPR/TNR on the validation split.*

---

## Figure 14 — Label distribution detail modal

**File:** `Images/metrics-label-modal.jpg`

Frequency table: Rotten (0) and Fresh (1) each 3,750 samples (50%). Confirms stratified evaluation sets remain class-balanced.

**Suggested caption:** *Figure 14. Class distribution on the evaluation split.*

---

## Figure 15 — Summary, threshold control, and exports

**File:** `Images/metrics-summary-actions.jpg`

Summary panel: evaluation set size, decision threshold (default 0.5), class counts. Slider enables precision–recall exploration via live recompute. Buttons export PDF and open detail modals (Figures 12–14).

**Suggested caption:** *Figure 15. Evaluation summary, threshold explorer, and export actions.*

---

## Figure 16 — Methodology transparency and integration path

**File:** `Images/pricing-transparency.jpg`

Links to statistical report, ROC/PR/calibration insights, and EDA. Three-step workflow: Analyze → Compare → Integrate (REST API). Documents how experimental results connect to product surfaces.

**Suggested caption:** *Figure 16. Methodology transparency and deployment workflow.*

---

## Cross-references

| Need | Document |
|------|----------|
| Test-split point estimates + CIs | [STATS_REPORT.md](STATS_REPORT.md) |
| Experimental protocol | [METHODOLOGY.md](METHODOLOGY.md) |
| Model governance | [MODEL_CARD.md](MODEL_CARD.md) |
| Reproduce artifacts | `make capstone` |
