# Figure Catalog — UI Screenshots for Reports and Reviews

**Project:** CineSentiment — IMDB movie review sentiment classification  
**Model:** Fine-tuned DistilBERT; baseline TF-IDF + logistic regression  
**System version:** 2.3.0

This document provides academic-style captions for each screenshot in `Images/`. Use these when writing papers, capstone reports, or design reviews. **Authoritative test-split numbers** are in [STATS_REPORT.md](STATS_REPORT.md); UI screenshots may show validation split or rounded display values. Software-architecture diagrams (Figures A.1–A.8) are specified in [ARCHITECTURE.md](ARCHITECTURE.md) and reproduced in the repository README.

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

## Architecture figures (A.1–A.8)

Software-architecture diagrams live in the README and in [ARCHITECTURE.md](ARCHITECTURE.md). They are numbered **A.** so they do not collide with the UI screenshots above.

| Figure | View | Location |
|--------|------|----------|
| **A.1** | System context (C4 Level 1) | README §2.1 · ARCHITECTURE §A.3 |
| **A.2** | Main container architecture (C4 Level 2) | README §2.2 · ARCHITECTURE §A.4 |
| **A.3** | Flask component diagram (C4 Level 3) | README §2.3 · ARCHITECTURE §A.5 |
| **A.4** | Training and evaluation pipeline | README §2.4 · ARCHITECTURE §A.6 |
| **A.5** | Online inference sequence | README §2.5 · ARCHITECTURE §A.7 |
| **A.6** | Explainability and optional RAG/agent | README §2.6 · ARCHITECTURE §A.8 |
| **A.7** | Deployment topology (Compose / Helm / multi-region) | README §2.7 · ARCHITECTURE §A.9 |
| **A.8** | Continuous integration | README §2.8 · ARCHITECTURE §A.10 |

**Suggested caption (architecture set):** *Figures A.1–A.8. C4-inspired software architecture of CineSentiment, from system context through serving, evaluation, and delivery.*

---

## AI / ML architecture figures (M.1–M.15)

Machine-learning diagrams (use-case, layered, neural, activity, sequence, state, data-flow, class). Principal set **M.1–M.12** is in README §3; extras **M.13–M.15** are in [ARCHITECTURE.md](ARCHITECTURE.md) Part B.

| Figure | View | Location |
|--------|------|----------|
| **M.1** | Use cases — all AI functions | README §3.1 |
| **M.2** | Layered ML architecture | README §3.2 |
| **M.3** | DistilBERT neural blocks | README §3.3 |
| **M.4** | Served models vs offline comparators | README §3.4 |
| **M.5** | Inference routing (language + backend) | README §3.5 |
| **M.6** | Composite analyse sequence | README §3.6 |
| **M.7** | RAG index / query data flow | README §3.7 |
| **M.8** | LangGraph agent state | README §3.8 |
| **M.9** | Aspects + tone arc | README §3.9 |
| **M.10** | Input × gradient XAI | README §3.10 |
| **M.11** | MLflow / W&B / Feast | README §3.11 |
| **M.12** | Backend ML module diagram | README §3.12 |
| **M.13** | Model-loader states | ARCHITECTURE §B.4 |
| **M.14** | Level-1 data flow | ARCHITECTURE §B.5 |
| **M.15** | Training + experiment tracking sequence | ARCHITECTURE §B.6 |

**Suggested caption (ML set):** *Figures M.1–M.15. Computer-science views of CineSentiment’s models, retrieval, agent, explainability, and MLOps — as implemented, including optional surfaces.*

---

## Theoretical framework figures (T.0–T.16)

Syllabus architectures (Stanford + MIT), each mapped to an artefact. **T.0–T.12** in README §4; extras in [THEORY.md](THEORY.md).

| Figure | View | Location |
|--------|------|----------|
| **T.0** | Stanford + MIT curriculum | README §4.0 · THEORY T.0 |
| **T.1** | Knowledge architecture | README §4.1 |
| **T.2** | Supervised problem + threshold | README §4.2 |
| **T.3** | Generalisation protocol (no leakage) | README §4.2 |
| **T.4** | Sparse TF-IDF vs contextual embeddings | README §4.3 |
| **T.5** | Classical TF-IDF → LR / NB / SVM | README §4.3 |
| **T.6** | Scaled dot-product attention | README §4.4 |
| **T.7** | Distillation + IMDB transfer | README §4.4 |
| **T.8** | Cross-entropy, AdamW, val F1 selection | README §4.5 |
| **T.9** | Bayes operating point \(\tau\) | README §4.5 |
| **T.10** | Discrimination / ranking / calibration | README §4.6 |
| **T.11** | Percentile bootstrap | README §4.6 |
| **T.12** | Paired test (McNemar + bootstrap Δ) | README §4.6 |
| **T.14** | CS231N saliency vs SHAP (not used) | THEORY T.14 |
| **T.15** | LoRA (offline) | THEORY T.15 |
| **T.16** | Dense retrieval not fused into logits | THEORY T.16 |

**Suggested caption (theory set):** *Figures T.1–T.16. Theoretical framework of CineSentiment: every diagram names a theory that is instantiated in code or evaluation.json.*

---

## Cross-references

| Need | Document |
|------|----------|
| Test-split point estimates + CIs | [STATS_REPORT.md](STATS_REPORT.md) |
| Experimental protocol | [METHODOLOGY.md](METHODOLOGY.md) |
| System architecture (C4 + sequences) | [ARCHITECTURE.md](ARCHITECTURE.md) Part A |
| AI / ML architecture (CS diagrams) | [ARCHITECTURE.md](ARCHITECTURE.md) Part B · README §3 |
| Theoretical framework (curriculum) | [THEORY.md](THEORY.md) · README §4 |
| Model governance | [MODEL_CARD.md](MODEL_CARD.md) |
| Reproduce artifacts | `make capstone` |
