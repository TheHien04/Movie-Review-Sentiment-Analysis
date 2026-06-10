# Changelog

All notable changes to the Movie Review Sentiment Analysis project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-06-10

### Added — FAANG-complete stack (100% checklist)
- **LangGraph** — `backend/services/agent_graph.py`, `/api/agent/analyze`, `/api/v2/agent/analyze`
- **vLLM + Triton** — `backend/services/remote_inference.py`, Docker Compose profiles, Triton model repo
- **Feast** — `feature_repo/`, `make feast-materialize`, `POST /api/features`
- **Playwright E2E** — `e2e/` browser tests, CI job `e2e-playwright`
- **Istio mesh** — `deploy/kubernetes/istio/` (Gateway, VirtualService, DestinationRule, mTLS)
- **Multi-region** — Helm `values-us-east.yaml` / `values-eu-west.yaml`, geo ingress, `deploy/kind/`
- **K8s CI** — dedicated GitHub Actions job for manifest validation + Helm multi-region template
- **Tests** — `tests/test_faang_stack.py`

---

## [2.2.0] - 2026-06-10

### Added — Silicon Valley tier (>90% checklist)
- **Weights & Biases** — `backend/wandb_utils.py`, unified `experiment_tracking.py` (MLflow + W&B)
- **LLM baseline** — `scripts/llm_baseline.py`, `make llm-baseline` (OpenAI or demo lexicon)
- **React + TypeScript** — `frontend-react/` (Vite), served at `/modern/`, `make frontend-react-build`
- **Kubernetes** — `deploy/kubernetes/` manifests + HPA + Ingress
- **Helm** — `deploy/helm/cinesentiment/` chart, `make helm-template`
- **Notebook 04** — `04_llm_baseline.ipynb`, `make eda-llm`
- **Tests** — `tests/test_silicon_valley.py` (W&B off, LLM demo, K8s YAML, modern route)
- **Docs** — `deploy/README.md`, updated `docs/SILICON_VALLEY_STACK.md`

---

## [2.1.0] - 2026-06-10

### Added — Capstone notebooks (full báo cáo set)
- **`02_error_analysis.ipynb`** — FP/FN charts, confidence, defense examples → `error_defense_samples.csv`
- **`03_model_comparison.ipynb`** — baselines, bootstrap CI, McNemar, comparison bars
- **`notebooks/README.md`** · `make notebooks` / `make eda-errors` / `make eda-comparison`

### Added — Silicon Valley / modern DS·SE stack
- **MLflow** — experiment tracking for train, baseline, LoRA (`artifacts/mlruns`, `make mlflow-ui`)
- **Prometheus** — `GET /metrics` on Flask + FastAPI; optional OpenTelemetry (`OTEL_ENABLED`)
- **FastAPI** — parallel API on port 8001 (`make serve-fastapi`, Docker `fastapi` service)
- **RAG** — ChromaDB + `all-MiniLM-L6-v2` (`make rag-index`, `/api/rag/query`)
- **LoRA (PEFT)** — `make lora-quick` / `lora-train`, comparison JSON vs full fine-tune
- **Docs** — `docs/SILICON_VALLEY_STACK.md`

---

## [2.0.0] - 2026-06-10

### Added — Industry polish
- **`make serve-prod`** — Gunicorn via `backend/gunicorn.conf.py`
- **Docker readiness probe** — `GET /health/ready` (model loaded) replaces liveness-only check
- **`make log-capstone`** — writes `artifacts/results/capstone_run_log.json` (git, metrics, McNemar)
- **Defense slide** — `docs/DEFENSE_SLIDE_LIMITATIONS.md` (McNemar not significant + model choice)

### Added — Platform v2
- **Developer API** — `/api/developer/me`, key registry, usage metering
- **Stripe billing** — `/api/billing/checkout` with demo Pro key fallback
- **Webhooks** — outbound `batch.complete` + HMAC-SHA256 test endpoint
- **Multilingual** — language detection + XLM-RoBERTa lazy inference
- **Aspect ML classifier** — `/api/aspects`, `make aspect-train`
- **SSE batch streaming** — `POST /api/predict/stream`
- **Full analyze** — `POST /api/analyze` (predict + explain + arc + aspects)
- **Developer portal** — `developer.html` with playground and Quick start
- **Live UI features** — draft preview, Rottenmeter, review tone arc
- **Keyboard shortcuts modal** — footer link + `?` key help panel

### Changed
- Version **2.0.0** across `VERSION`, OpenAPI, pyproject, frontend eyebrows
- `docs/CAPSTONE_AUDIT.md` — coursework evidence map for môn thống kê
- `docs/STATS_REPORT.md` — synced via `make sync-docs`
- Developer page — server version banner, v2 route detection
- Voice input — interim flush, auto-stop on silence, `vi-VN` support

### Fixed
- Batch CSV 405 fallback when stream endpoint unavailable
- Developer API 404 when server not restarted after upgrade
- Footer `? shortcuts` → clickable Keyboard shortcuts panel

---

## [1.7.0] - 2026-05-27

### Added — Industry & Senior DS/SE Standards
- **Effect sizes** — Cohen's h, odds ratio, magnitude labels in `ml_core.py` + hypothesis artifact
- **Bonferroni correction** — multiple comparison adjustment across all baseline hypothesis tests
- **Multi-baseline hypothesis tests** — DistilBERT vs LogReg, Naive Bayes, and SVM in one run
- **Service layer** — `backend/services/inference.py`, `backend/services/explainability.py`
- **Full OpenAPI 3.0.3** — 26 endpoints documented with schemas and error responses
- **E2E smoke tests** — `tests/test_e2e_flows.py` (15 flows: pages, predict→explain, security headers)
- **pre-commit** — `.pre-commit-config.yaml` (black, flake8, yaml/json checks)
- **`make premium`** — capstone + ablation-quick pipeline target

### Changed
- `hypothesis_tests.py` — compares all 3 TF-IDF baselines; legacy `mcnemar` fields preserved
- `summary-page.js` — renders effect sizes, Bonferroni, multi-baseline comparison table
- All 3 baselines trained and merged into `evaluation.json`
- Version **1.7.0** across frontend, pyproject.toml, OpenAPI

---

## [1.6.0] - 2026-05-26

### Added — Academic Grade-A Enhancements
- **EDA notebook** (`notebooks/01_eda_imdb.ipynb`) — 17-cell exploratory data analysis: class balance, text/word/token length distributions, top unigrams & bigrams, word clouds, vocabulary overlap (Jaccard), data quality checks
- **Additional baselines** — Naive Bayes (MultinomialNB) and SVM (LinearSVC + CalibratedClassifierCV) in `scripts/baseline_tfidf.py`; 4-model comparison table
- **Ablation study** (`scripts/ablation_study.py`) — systematic hyperparameter sweep: max_length ∈ {64,128,256,512}, learning_rate ∈ {1e-5,2e-5,5e-5,1e-4}, epochs ∈ {1,2,3,5}; results in `artifacts/results/ablation_results.json`
- **Model-derived interpretability** — `/api/explain` endpoint using input × gradient token importance from DistilBERT (replaces lexicon heuristic when model available)
- **Frontend auto-upgrade** — `explainable-ai.js` tries `/api/explain` first, falls back to lexicon heuristic
- **`requirements-lock.txt`** — pinned dependency versions for full reproducibility
- **Makefile targets** — `make ablation`, `make ablation-quick`, `make eda`
- **METHODOLOGY.md** rewritten — formal problem statement, related work (6 references), ablation protocol, interpretability section, limitations disclosure

### Changed
- **`baseline_tfidf.py`** — now trains 3 classical baselines (LogReg, NB, SVM) in a single run
- **`requirements-train.txt`** — added seaborn, wordcloud, nbconvert, jupyter
- **`docs/METHODOLOGY.md`** — expanded from 4 sections to 12 sections with academic references

---

## [1.5.0] - 2026-05-25

### Added
- **`.dockerignore`** — reduces Docker build context (excludes venv, logs, tests, docs)
- **`compare.css`** — extracted inline styles from `compare.html` to dedicated stylesheet
- **Mobile responsive `data-viz.css`** — media queries for charts, tables, and controls at 640px
- **Skip-links** on all pages (index, checklist, insights, summary) for keyboard accessibility

### Changed
- **main.js** — removed ~400 lines of dead evaluation/dataset code (now handled by dedicated page scripts); removed 9 debug `console.log` statements; fixed 3 empty `catch` blocks; replaced `alert()` with toast notifications
- **theme.js / integrate-utils.js** — removed debug console output
- **compare.html** — replaced `alert()` with toast; added `aria-label` to action buttons; extracted inline CSS
- **dataset.html** — fixed `layout.js` load position (moved from footer to after nav)
- **404.html** — added viewport meta, theme support, cinema-themed design, correct `data-page`
- **Footer copyright** updated to 2026; all pages now show consistent **v1.5.0**
- **Vietnamese text fragments** replaced with English across all frontend files
- **CI/CD** — updated GitHub Actions to latest versions (checkout@v4, setup-python@v5, cache@v4)
- **Dockerfile** — gunicorn workers now configurable via `GUNICORN_WORKERS` env var
- **Scripts** — extracted duplicated `predict_probs()` from 4 scripts into shared `ml_core.py`
- **CHANGELOG** — removed stale planned features and outdated release timeline

### Fixed
- Version inconsistency (some pages showed "v1.4" instead of matching version)

---

## [1.4.1] - 2026-05-24

### Added
- **Hypothesis tests** — McNemar (paired errors) + bootstrap difference test (accuracy/F1) for DistilBERT vs TF-IDF on test split
- **`make hypothesis-tests`** — writes `hypothesis_tests` into `evaluation.json`; included in `make capstone`
- **Statistics page** section “Hypothesis tests (paired comparison)”
- Unit tests in `tests/test_hypothesis.py`
- **Defense checklist** (`/checklist.html`) + **`/api/capstone-status`** — live capstone readiness score
- **`make sync-docs`** — auto-updates `docs/STATS_REPORT.md` from `evaluation.json`
- Nav **Defense**, shortcut `g` then `k`, home capstone score in status bar
- Statistics **Print report** button

### Changed
- Metrics page: note that threshold slider is for exploration only (report uses 50% artifact)
- Analyze page: voice input browser/localhost hint
- `docs/CAPSTONE_AUDIT.md`, `docs/STATS_REPORT.md`, `docs/METHODOLOGY.md` — formal comparison protocol
- Version **1.4.1**; `make evaluate` preserves `hypothesis_tests` in artifact

---

## [1.4.0] - 2026-05-23

### Added
- **Statistics Report page** (`/summary.html`) — test-split headline metrics, bootstrap CIs, derived rates, baseline Δ table
- **`/api/stats-report`** — coursework JSON summary from `evaluation.json`
- **`/api/calibration-curve`** — reliability diagram, Brier score, ECE
- **Calibration chart** on Insights (reliability diagram + perfect-calibration diagonal)
- **`docs/STATS_REPORT.md`** — printable statistical report for báo cáo
- **`docs/DEMO_SCRIPT.md`** — 5-minute defense script (statistics-focused)
- Nav link **Statistics**; shortcut `g` then `s`

### Changed
- `insights-curves` / `_curves_for_split` include `calibration_curve` in artifacts
- Home “What’s new” v1.4; footer version **1.4.0**

---

## [1.3.0] - 2026-05-23

### Added
- **Statistical summary API** (`/api/statistical-summary`) — derived rates from confusion matrix, optimal F1 threshold, model deltas
- **PR curve API** (`/api/pr-curve`) and **Precision–Recall chart** on Insights (with AP label)
- **Error analysis JSON API** (`/api/error-analysis`) — powers in-app viewer with FP/FN counts
- **Metrics page:** val/test split selector, derived stats panel (sensitivity, specificity, FPR/FNR, balanced accuracy)
- **Model comparison:** bootstrap CI columns, average precision, Δ row (DistilBERT − TF-IDF), val/test split
- **F1-optimal threshold** display on Insights threshold sweep and Metrics statistical summary

### Changed
- `generate_insights_curves.py` stores `pr_curve` in evaluation artifact
- Home “What’s new” updated for v1.3; nav footer version **1.3.0**

---

## [1.2.0] - 2026-05-23

### Added
- **Error analysis viewer** on Metrics page — filter FP/FN misclassified test reviews in-app
- **Bootstrap 95% CI** displayed under validation metric tiles (from `evaluation.json` or live recompute)
- **Compare demo chips** — pair presets + per-review Fresh/Rotten samples

### Changed
- Unified **cinema theme** (`cinema-unified.css`) across all pages; removed legacy purple CSS from Metrics/Dataset loads
- Home “What’s new” updated for v1.2; Insights links to error viewer

---

## [1.1.0] - 2026-05-23

### Added
- **Insights** page (`/insights.html`) — ROC curve and threshold sweep charts
- API: `/api/roc-curve`, `/api/threshold-curve`, `/api/dashboard-summary`
- Evaluation artifact stores precomputed `curves` per split (`make evaluate`)
- Global keyboard shortcuts (`g` + `h/m/i/d/a`, `?` for help)
- Home: live system status from `/health`, “What’s new in v1.1” section
- Analyze page: one-click **demo review** chips

### Changed
- Nav footer version **1.1.0**; health endpoint includes `version`

### UI polish (v1.1.1)
- Responsive **hamburger navigation** + navbar **theme toggle** (replaces duplicate floating button)
- **Back-to-top** button; **Insights PDF export**
- Theme + shortcuts on all main pages; README quick-start for `make serve`

---

## [1.0.0] - 2026-05-23

### Added (release hardening)
- Statistical methodology doc, model card, release checklist, OpenAPI + Swagger UI (`/api/docs`)
- `backend/ml_core.py`, `Makefile`, `pyproject.toml`, English design system UI
- `artifacts/results/evaluation.json` from reproducible training pipeline
- `accelerate` dependency for Hugging Face Trainer

### Changed
- Removed mock API metrics; honest `model_is_finetuned` health fields
- Default data paths: `data/raw/`; evaluation uses saved artifact
- Untracked `backend/.venv` from git

### Metrics (train-fast checkpoint)
- Test: accuracy 87.2%, F1 86.7%, ROC-AUC 94.9% (see `evaluation.json`)

---

## Known Limitations

1. CPU-only inference (GPU support available but not auto-detected)
2. Batch processing limited to 10,000 rows
3. Text limited to 256 tokens (longer reviews are truncated)
4. No user authentication (capstone scope)
5. No persistent database (results are session-based)

## Dependencies

### Backend
- Flask 2.0+, PyTorch 1.9+, Transformers 4.0+, Scikit-learn 0.24+, Pandas 1.2+

### Frontend
- Bootstrap 5.3+, Chart.js 4.4+, Modern browser (ES6+)

---

**Last Updated:** May 2026
