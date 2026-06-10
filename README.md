# CineSentiment — IMDB Movie Review Sentiment Analysis

[![CI](https://github.com/TheHien04/Movie-Review-Sentiment-Analysis/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/TheHien04/Movie-Review-Sentiment-Analysis/actions/workflows/ci-cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)

End-to-end binary sentiment classification for English movie reviews: a **DistilBERT** classifier with rigorous offline evaluation (bootstrap confidence intervals, baseline comparison, hypothesis tests), exposed through a production-style **REST API**, cinema-themed web UI, and reproducible training pipeline.

**Author:** The Hien · **Version:** 2.3.0 · **License:** MIT

---

## Executive summary

| Dimension | Detail |
|-----------|--------|
| Task | Binary sentiment: Fresh (positive) vs Rotten (negative) |
| Dataset | IMDB 50,000 labeled reviews |
| Split protocol | 70% train / 15% validation / 15% test, stratified, `random_state=42` |
| Primary model | Fine-tuned DistilBERT (`distilbert-base-uncased`) |
| Baselines | TF-IDF + logistic regression (same splits and metrics) |
| Held-out test (n = 7,500) | Accuracy 91.76%, F1 91.80%, ROC-AUC 97.35% |
| Uncertainty | Bootstrap 95% CI, 500 resamples, percentile method |
| Inference surface | Flask (:8000), FastAPI v2 (:8001), batch CSV, developer API |
| Quality gate | 102 pytest cases, CI on Python 3.10–3.12, lint, security scan |

Primary statistical evidence lives in [docs/STATS_REPORT.md](docs/STATS_REPORT.md). Experimental design: [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Screenshot annotations: [docs/FIGURES.md](docs/FIGURES.md).

---

## Research question

Does a fine-tuned **DistilBERT** classifier achieve reportable generalization on a **held-out test split** (point estimates with bootstrap CIs), and does it outperform a classical **TF-IDF + logistic regression** baseline under a fixed, stratified data protocol?

McNemar and delta reporting are documented in [docs/STATS_REPORT.md](docs/STATS_REPORT.md) and [docs/DEFENSE_SLIDE_LIMITATIONS.md](docs/DEFENSE_SLIDE_LIMITATIONS.md).

---

## System overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  Web UI     │────▶│  Flask API :8000 │────▶│  DistilBERT inference│
│  (frontend) │     │  FastAPI :8001   │     │  + optional RAG/XAI  │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                              │
                              ▼
                    artifacts/results/evaluation.json
                    (metrics, CIs, baselines, hypothesis tests)
```

| Layer | Responsibility |
|-------|----------------|
| `scripts/` | Train, evaluate, baseline, error analysis, hypothesis tests, ablation |
| `backend/ml_core.py` | Split paths, metrics, bootstrap CIs, artifact I/O |
| `backend/services/` | Inference, explainability, aspects, RAG, billing, webhooks |
| `frontend/` | Analyze, compare, metrics dashboard, insights, developer portal |
| `artifacts/results/` | Versioned evaluation artifacts for UI and reports |
| `notebooks/` | EDA, error analysis, model comparison (HTML export via `make notebooks`) |

Architecture detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · OpenAPI: [docs/openapi.yaml](docs/openapi.yaml) · `/api/docs`

---

## Reproducibility contract

From a clean clone:

```bash
git clone https://github.com/TheHien04/Movie-Review-Sentiment-Analysis.git
cd Movie-Review-Sentiment-Analysis
make install
make capstone      # baseline → train → evaluate → hypothesis tests → pytest
make serve         # http://127.0.0.1:8000
```

| Command | Output |
|---------|--------|
| `make capstone` | Full academic pipeline; writes `artifacts/results/capstone_run_log.json` |
| `make evaluate` | Refreshes `artifacts/results/evaluation.json` |
| `make test` | 102 pytest cases |
| `make github-check` | Secret scan + full test suite (pre-push) |
| `make serve-prod` | Gunicorn production WSGI |
| `make notebooks` | Executes notebooks → `artifacts/results/*.html` |

Training uses **train only**. Validation supports monitoring and threshold exploration. **Test metrics are reported once** as primary evidence.

---

## UI and evaluation screenshots

Captions below map to [docs/FIGURES.md](docs/FIGURES.md) for thesis-style citation text.

### Product surfaces

**Figure 1.** Landing page — problem statement and model performance summary (DistilBERT on IMDB).

![Landing hero](Images/home-landing-hero.jpg)

**Figure 2.** Landing page — example outputs and workflow modules (single, batch, XAI, compare, API).

![Workflows](Images/home-workflows.jpg)

**Figure 3.** Single-review analysis — text input, live draft inference, Rottenmeter gauge.

![Single review analysis](Images/analyze-single-review.jpg)

**Figure 4.** Batch analysis — CSV upload, verdict table, export.

![Batch CSV analysis](Images/analyze-batch-csv.jpg)

**Figure 5.** Voice input — speech-to-text before classification.

![Voice input](Images/analyze-voice-input.jpg)

**Figure 6.** Side-by-side comparison — labels, confidence, token-level attribution (input × gradient).

![Compare side by side](Images/compare-side-by-side.jpg)

**Figure 7.** Comparison charts — confidence bar/donut and natural-language summary.

![Compare charts](Images/compare-charts.jpg)

### Model evaluation dashboard

**Figure 8.** Dataset overview — train / validation / test sizes (35k / 7.5k / 7.5k).

![Dataset overview](Images/metrics-dataset-overview.jpg)

**Figure 9.** Model comparison — DistilBERT vs TF-IDF on test split with 95% bootstrap CIs; error analysis panel.

![Model comparison](Images/metrics-model-comparison.jpg)

**Figure 10.** Validation metrics and derived rates (sensitivity, specificity, PPV, NPV).

![Validation summary](Images/metrics-validation-summary.jpg)

**Figure 11.** Confusion matrix, label distribution (50/50), multi-metric bar chart.

![Confusion and metrics](Images/metrics-confusion-label-bars.jpg)

**Figures 12–14.** Detail modals — metrics with CIs, confusion matrix, label distribution.

| Metrics | Confusion matrix | Label distribution |
|---------|------------------|-------------------|
| ![Metrics modal](Images/metrics-detail-modal.jpg) | ![Confusion modal](Images/metrics-confusion-modal.jpg) | ![Label modal](Images/metrics-label-modal.jpg) |

**Figure 15.** Summary and actions — decision threshold slider, PDF export, detail views.

![Summary and actions](Images/metrics-summary-actions.jpg)

**Figure 16.** Model transparency — links to stats report, insights curves, EDA; Analyze → Compare → Integrate workflow.

![Transparency and pricing](Images/pricing-transparency.jpg)

---

## API reference (core)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness; model load status |
| `GET` | `/health/ready` | Readiness (inference available) |
| `POST` | `/api/predict` | Single text or batch CSV |
| `GET` | `/api/metrics` | Metrics by split and threshold |
| `GET` | `/api/model-comparison` | DistilBERT vs baselines table |
| `GET` | `/artifacts/results/evaluation.json` | Full evaluation artifact |

Extended v2 routes (FastAPI :8001), developer keys, webhooks, and RAG: see [docs/openapi.yaml](docs/openapi.yaml).

---

## Repository layout

| Path | Role |
|------|------|
| `backend/` | Flask app, inference, ML core, services |
| `frontend/` | Static web application |
| `frontend-react/` | Optional React UI at `/modern/` |
| `scripts/` | Training and evaluation pipeline |
| `notebooks/` | Reproducible analysis notebooks |
| `tests/` | Unit, integration, capstone, E2E contracts |
| `deploy/` | Kubernetes, Helm, Triton model repo |
| `docs/` | Methodology, stats, model card, figures |

Full tree: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)

---

## Testing and CI

```bash
make test              # pytest (102 cases)
make e2e-playwright    # browser E2E (optional)
make k8s-validate      # manifest YAML lint
```

GitHub Actions: lint (flake8, black), security (bandit, pip-audit), multi-version pytest, Docker build, Kubernetes/Helm validation, Playwright E2E.

---

## Documentation index

| Document | Audience | Content |
|----------|----------|---------|
| [docs/STATS_REPORT.md](docs/STATS_REPORT.md) | Statistics / DS | Test metrics, CIs, confusion matrix, baselines |
| [docs/METHODOLOGY.md](docs/METHODOLOGY.md) | Reviewers | Protocol, related work, ablation |
| [docs/MODEL_CARD.md](docs/MODEL_CARD.md) | ML governance | Intended use, limitations, metrics |
| [docs/FIGURES.md](docs/FIGURES.md) | Report writing | Per-screenshot academic captions |
| [docs/DEFENSE_SLIDE_LIMITATIONS.md](docs/DEFENSE_SLIDE_LIMITATIONS.md) | Defense | McNemar interpretation, model choice |
| [docs/SILICON_VALLEY_STACK.md](docs/SILICON_VALLEY_STACK.md) | Platform | MLflow, observability, K8s, RAG |
| [SECURITY.md](SECURITY.md) | Operators | Secrets, rate limits, reporting |
| [docs/GITHUB.md](docs/GITHUB.md) | Contributors | Branch policy, `make github-check` |

---

## Deployment

| Target | Command |
|--------|---------|
| Local dev | `make serve` |
| Production WSGI | `make serve-prod` |
| Docker Compose | `docker compose up` |
| Kubernetes | `deploy/README.md` |

Environment template: `.env.example`. Never commit `.env`.

---

## Citation

```bibtex
@misc{cinesentiment2026,
  author       = {The Hien},
  title        = {CineSentiment: IMDB Movie Review Sentiment Analysis with DistilBERT},
  year         = {2026},
  howpublished = {\url{https://github.com/TheHien04/Movie-Review-Sentiment-Analysis}},
  note         = {Statistical Machine Learning capstone; bootstrap CIs, baseline comparison}
}
```

---

**Course context:** Statistical Machine Learning capstone  
**Last updated:** June 2026
