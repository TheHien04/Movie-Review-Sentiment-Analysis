# Project structure

Production-grade layout for **CineSentiment** — IMDB movie-review sentiment (DistilBERT + classical baselines).

```
Movie-Review-Sentiment-Analysis/
│
├── backend/                      # API & ML runtime
│   ├── app.py                    # Flask app: routes, middleware, static frontend
│   ├── ml_core.py                # Metrics, hypothesis tests, artifacts, paths
│   ├── services/
│   │   ├── inference.py          # Batch/single predict (torch)
│   │   └── explainability.py     # Input×gradient XAI
│   └── routes/                   # Blueprint stubs (future modularization)
│
├── frontend/                     # Multi-page SPA (static HTML + JS)
│   ├── assets/                   # logo.svg, hero-poster.svg
│   ├── data/                     # Static JSON/JS for offline charts
│   ├── *.html                    # One page per product surface
│   ├── layout.js                 # Shared nav, footer, theme
│   ├── config.js                 # API base URL
│   ├── *-page.js                 # Page controllers (summary, evaluation, …)
│   └── *.css                     # design-system → cinema-theme → page CSS
│
├── scripts/                      # Reproducible ML pipeline (CLI)
│   ├── data_preprocessing.py
│   ├── model_training.py
│   ├── evaluate_model.py
│   ├── baseline_tfidf.py
│   ├── hypothesis_tests.py
│   ├── ablation_study.py
│   └── …
│
├── tests/                        # pytest: API, E2E, hypothesis, capstone
├── docs/                         # Methodology, OpenAPI, model card, release
├── data/raw/                     # IMDB CSV splits (not committed at scale)
├── sentiment_model/              # Tokenizer + fine-tuned weights (after make train)
├── artifacts/results/            # evaluation.json, curves, baselines
├── notebooks/                    # EDA (optional, academic)
│
├── Makefile                      # Single entry point for all workflows
├── pyproject.toml                # Tooling (ruff, pytest)
├── requirements-lock.txt         # Pinned deps for reproducibility
├── Dockerfile / docker-compose.yml
└── VERSION                       # Semver (read by API /health)
```

## Layer responsibilities

| Layer | Role | Key tech |
|-------|------|----------|
| **Frontend** | Product UI, charts, export | HTML5, Bootstrap 5, Chart.js, vanilla JS |
| **API** | Inference, metrics, artifacts | Flask 3, Gunicorn |
| **ML core** | Stats, CIs, McNemar, calibration | scikit-learn, scipy, transformers |
| **Pipeline** | Train → evaluate → report | PyTorch, Hugging Face, pandas |
| **Ops** | CI, Docker, health probes | GitHub Actions, `/health`, `/health/ready` |

## Entry points

```bash
make install      # venv + dependencies
make serve        # http://127.0.0.1:8000 (auto hub fallback if no local weights)
make train        # Fine-tune DistilBERT on IMDB
make evaluate     # Test metrics → artifacts/results/evaluation.json
make capstone     # Full academic pipeline
make test         # pytest (60+ tests)
```

## Frontend page map

See [frontend/README.md](frontend/README.md) for script load order per page.

## API surfaces

- **Product:** `/api/predict`, `/api/explain`, `/api/usage`
- **Analytics:** `/api/metrics`, `/api/stats-report`, `/api/statistical-summary`
- **Ops:** `/health`, `/health/ready`, `/api/capstone-status`
- **Docs:** `/api/docs` → OpenAPI Swagger UI

## Configuration

Copy `.env.example` → `.env`. In **local dev**, if `sentiment_model/` has no weight files, the server auto-enables `HUB_MODEL_FALLBACK` (SST-2) so Analyze works without `make train`.
