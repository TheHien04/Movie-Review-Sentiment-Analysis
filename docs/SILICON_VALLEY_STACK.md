# Silicon Valley / Modern DS·SE Stack (v2.3 — 100%)

Industry patterns integrated alongside the capstone statistics pipeline.

---

## 1. MLflow — experiment tracking

| Item | Detail |
|------|--------|
| **URI** | `artifacts/mlruns` (override: `MLFLOW_TRACKING_URI`) |
| **Experiments** | `cinesentiment-distilbert`, `cinesentiment-baselines`, `cinesentiment-lora` |
| **Logged** | Params, test F1/accuracy, confusion matrix PNG |
| **UI** | `mlflow ui --backend-store-uri artifacts/mlruns` |

```bash
make train      # logs DistilBERT run
make baseline   # logs each TF-IDF baseline
make lora-quick # logs LoRA adapter run
```

Disable: `MLFLOW_ENABLED=false`

---

## 2. Observability — Prometheus + OpenTelemetry

| Endpoint | Purpose |
|----------|---------|
| `GET /metrics` (Flask :8000) | Prometheus scrape — request count, latency, predict counter |
| `GET /metrics` (FastAPI :8001) | Same metrics from v2 service |

Enable OpenTelemetry (console exporter): `OTEL_ENABLED=true`

Example Prometheus scrape:

```yaml
scrape_configs:
  - job_name: cinesentiment
    static_configs:
      - targets: ["127.0.0.1:8000", "127.0.0.1:8001"]
```

---

## 3. FastAPI — parallel modern API

| Port | Stack |
|------|--------|
| **8000** | Flask + Gunicorn (`make serve` / `make serve-prod`) |
| **8001** | FastAPI + Uvicorn (`make serve-fastapi`) |

| Route | Description |
|-------|-------------|
| `POST /api/v2/predict` | Sentiment inference |
| `POST /api/v2/analyze` | Predict + similar reviews (RAG) |
| `POST /api/v2/rag/query` | Semantic search only |
| `GET /api/v2/rag/stats` | Chroma collection size |

```bash
make serve-fastapi
curl -X POST http://127.0.0.1:8001/api/v2/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"Visually stunning but predictable."}'
```

---

## 4. RAG — Chroma + sentence-transformers

| Item | Value |
|------|--------|
| **Embed model** | `sentence-transformers/all-MiniLM-L6-v2` |
| **Store** | `data/chroma/` |
| **Index** | `make rag-index` (500 sample reviews) |
| **Flask** | `POST /api/rag/query`, `GET /api/rag/stats` |

```bash
make rag-index
curl -X POST http://127.0.0.1:8000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"text":"great acting terrible plot","k":5}'
```

Disable: `RAG_ENABLED=false`

---

## 5. LoRA (PEFT) — parameter-efficient fine-tune

Modern adapter training vs full fine-tune on same test split.

```bash
make lora-quick    # 500 rows, 1 epoch (~minutes on CPU/GPU)
make lora-train    # larger run
cat artifacts/results/lora_comparison.json
```

Compares LoRA test F1 vs `evaluation.json` full DistilBERT metrics.

---

## 6. Weights & Biases — dual experiment tracking

| Item | Detail |
|------|--------|
| **Wrapper** | `backend/experiment_tracking.py` — MLflow + W&B in one `experiment_run()` |
| **Scripts** | `model_training.py`, `baseline_tfidf.py`, `lora_finetune.py`, `llm_baseline.py` |
| **Project** | `WANDB_PROJECT=cinesentiment` |

```bash
WANDB_ENABLED=true wandb login
make train    # logs to MLflow + W&B
```

Disable in CI/tests: `WANDB_MODE=disabled` or `WANDB_ENABLED=false`

---

## 7. LLM zero-shot baseline

Compare **GPT-4o-mini** (or demo lexicon) vs DistilBERT on the same test split.

```bash
make llm-baseline                    # demo mode (no API key)
OPENAI_API_KEY=sk-... make llm-baseline --max-rows 200
```

Results merge into `artifacts/results/evaluation.json` → `baselines.llm_*`.

Notebook: `04_llm_baseline.ipynb` · `make eda-llm`

---

## 8. React + TypeScript UI

| Item | Detail |
|------|--------|
| **Stack** | Vite + React 18 + TypeScript |
| **Path** | `/modern/` (classic cinema UI unchanged at `/`) |
| **Build** | `make frontend-react-build` |
| **Dev** | `cd frontend-react && npm run dev` (:5173, proxies `/api`) |

Pages: Home, Analyze, Stats — same dark/gold cinema theme.

---

## 9. Kubernetes & Helm

| Path | Purpose |
|------|---------|
| `deploy/kubernetes/` | Namespace, ConfigMap, Deployments (Flask + FastAPI), HPA, Ingress, PVC |
| `deploy/helm/cinesentiment/` | Helm chart with values overrides |
| `deploy/README.md` | Apply / install instructions |

```bash
make k8s-validate
make helm-template
```

---

## 10. LangGraph — agent orchestration

Multi-step graph: **validate → predict → RAG → summarize**.

| Route | Stack |
|-------|--------|
| `POST /api/agent/analyze` | Flask |
| `POST /api/v2/agent/analyze` | FastAPI |

```bash
curl -X POST http://127.0.0.1:8000/api/agent/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Visually stunning but the plot drags."}'
```

Disable: `AGENT_ENABLED=false`

---

## 11. vLLM + NVIDIA Triton — remote inference

| Backend | Env | Compose |
|---------|-----|---------|
| **local** (default) | `INFERENCE_BACKEND=local` | — |
| **vLLM** | `INFERENCE_BACKEND=vllm`, `VLLM_BASE_URL` | `docker compose --profile vllm up` |
| **Triton** | `INFERENCE_BACKEND=triton`, `TRITON_URL` | `docker compose --profile triton up` |

```bash
GET /api/inference/backend
# Model repo: deploy/triton/model_repository/
```

---

## 12. Feast — feature store

| Path | Purpose |
|------|---------|
| `feature_repo/` | Feast entities + FeatureView |
| `scripts/feast_materialize.py` | Build parquet + online store |
| `POST /api/features` | Online feature lookup |

```bash
make feast-materialize
```

---

## 13. Playwright — browser E2E

```bash
make e2e-playwright    # starts Flask + Chromium tests
cd e2e && npm test
```

Tests: home, batch page, `/api/predict`, `/modern/`.

---

## 14. Istio service mesh

Manifests: `deploy/kubernetes/istio/` — Gateway, VirtualService, DestinationRule, mTLS.

```bash
make k8s-apply-istio
```

---

## 15. Multi-region deploy

| Overlay | Region | Host |
|---------|--------|------|
| `values-us-east.yaml` | us-east-1 | us-east.cinesentiment.example.com |
| `values-eu-west.yaml` | eu-west-1 | eu-west.cinesentiment.example.com |
| `multi-region/geo-ingress.yaml` | global | geo-DNS active-active |

```bash
make helm-us-east
make helm-eu-west
make kind-up    # local cluster smoke
```

---

## One-command modern setup

```bash
make install
make silicon-valley-100   # Feast + React + LLM + K8s + Helm + pytest (100%)
make silicon-valley       # v2.2 subset
make rag-index
make lora-quick          # optional demo
make serve-prod &        # Flask :8000
make serve-fastapi &     # FastAPI :8001
```

---

## Docker Compose

```bash
docker compose up   # backend (Gunicorn) + nginx frontend + fastapi on 8001
```

Services: `backend` (:8000), `fastapi` (:8001), `frontend` (:8080)

---

*Capstone statistics unchanged — see `docs/STATS_REPORT.md` and `make capstone`.*
