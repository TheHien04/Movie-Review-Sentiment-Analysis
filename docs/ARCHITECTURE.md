# System Architecture — CineSentiment

**Document type:** Software architecture description (C4-inspired)  
**System version:** 2.3.0  
**Audience:** Examiners, reviewers, and operators  
**Companion reports:** [METHODOLOGY.md](METHODOLOGY.md) · [STATS_REPORT.md](STATS_REPORT.md) · [MODEL_CARD.md](MODEL_CARD.md)

This document is the canonical architecture specification. The GitHub README reproduces the principal diagrams for first-pass reading.

| Prefix | Scope |
|--------|--------|
| **A.** | Software architecture (C4, deployment, CI) — Part A |
| **M.** | AI / ML architecture (models, RAG, agent, XAI, MLOps) — Part B |
| **1–16** | UI screenshots — [FIGURES.md](FIGURES.md) |

---

## A.1 Purpose and scope

CineSentiment is an end-to-end binary sentiment classifier for English movie reviews. A fine-tuned DistilBERT encoder is evaluated under a fixed, stratified IMDB protocol and served through a production-style HTTP stack (Flask on port 8000; FastAPI v2 on port 8001). Classical TF-IDF baselines, bootstrap confidence intervals, and paired hypothesis tests are first-class artifacts—not afterthoughts.

**In scope:** data protocol, training/evaluation pipeline, inference path, explainability, optional RAG/agent extensions, observability, and deployment topology.  
**Out of scope:** multi-domain transfer evaluation; high-stakes decision systems; **Model Context Protocol (MCP) servers** — this repository is a REST/ML service, not an MCP tool host.

---

## A.2 Quality attributes

| Attribute | Design response |
|-----------|-----------------|
| **Reproducibility** | Stratified splits with `random_state=42`; pinned `requirements-lock.txt`; `make capstone` as the single academic pipeline |
| **Statistical honesty** | Test split reported once; bootstrap 95% CIs; McNemar and bootstrap Δ vs TF-IDF; no mock metrics |
| **Availability** | Liveness `/health` and readiness `/health/ready`; Gunicorn workers; Kubernetes HPA |
| **Integrity** | CSRF origin check, CORS allowlist, rate limits, CSP/HSTS in production |
| **Observability** | Prometheus `/metrics`; optional OpenTelemetry; MLflow / W&B experiment logs |
| **Explainability** | Input × gradient token attribution; lexicon heuristic labelled as non-model |
| **Operability** | Docker Compose, Helm, Istio manifests, Kind smoke cluster |

---

## A.3 Context diagram (C4 Level 1)

Persons and external systems that interact with CineSentiment. The software system is a single bounded context: *movie-review sentiment as a service plus an evaluation workbench*.

```mermaid
flowchart TB
    Analyst["Analyst / examiner"]
    User["End user"]
    Operator["Operator"]

    subgraph Cine["CineSentiment"]
        Workbench["Cinema workbench + REST APIs"]
        Model["Fine-tuned DistilBERT"]
        Evidence["evaluation.json · CIs · McNemar"]
        Workbench --- Model
        Workbench --- Evidence
    end

    IMDB["IMDB via Hugging Face datasets"]
    Hub["Hugging Face Hub"]
    Chroma["Chroma vector store"]
    Prom["Prometheus"]
    Track["MLflow / W&B"]

    Analyst -->|"make capstone, /summary.html"| Cine
    User -->|"HTTPS POST /api/predict"| Cine
    Operator -->|"Compose / Helm / probes"| Cine
    Cine -->|"make preprocess"| IMDB
    Cine -->|"tokenizer + encoder"| Hub
    Cine -->|"similar reviews"| Chroma
    Cine -->|"GET /metrics"| Prom
    Cine -->|"params, test F1"| Track
```

**Caption (Figure A.1).** CineSentiment sits between human roles (analyst, end user, operator) and external data/model/observability systems. Training data are regenerated locally from IMDB; they are not stored in git.

---

## A.4 Container diagram (C4 Level 2) — main architecture

This is the **main runtime architecture**. Containers are independently deployable processes or durable stores.

```mermaid
flowchart TB
    subgraph Clients["Clients"]
        Browser["Browser<br/>frontend/ cinema UI<br/>optional /modern React SPA"]
        Dev["Developer / CI<br/>curl, pytest, Playwright"]
    end

    subgraph Edge["Edge"]
        Nginx["Nginx :8080<br/>static frontend proxy"]
        Ingress["Ingress / Istio Gateway<br/>TLS, mTLS, geo-DNS"]
    end

    subgraph Runtime["Application runtime"]
        Flask["Flask + Gunicorn :8000<br/>backend/app.py<br/>product API, metrics, XAI, SSE"]
        FastAPI["FastAPI + Uvicorn :8001<br/>backend/fastapi_app.py<br/>v2 predict, RAG, agent"]
    end

    subgraph OptionalInfer["Optional remote inference"]
        vLLM["vLLM OpenAI-compatible :8002"]
        Triton["NVIDIA Triton :8003"]
    end

    subgraph ML["ML assets"]
        Weights["sentiment_model/<br/>DistilBERT tokenizer + weights"]
        EvalJSON["artifacts/results/<br/>evaluation.json, curves, errors"]
        Splits["data/raw/<br/>train / val / test CSV"]
        Chroma["data/chroma/<br/>MiniLM embeddings"]
        Feast["feature_repo/<br/>Feast online features"]
    end

    subgraph Obs["Observability"]
        Prom["Prometheus scrape<br/>GET /metrics"]
        MLflow["MLflow artifacts/mlruns"]
    end

    Browser --> Nginx
    Browser --> Flask
    Dev --> Flask
    Dev --> FastAPI
    Nginx --> Flask
    Ingress --> Flask
    Ingress --> FastAPI
    Flask --> Weights
    Flask --> EvalJSON
    FastAPI --> Weights
    FastAPI --> Chroma
    Flask -.->|"INFERENCE_BACKEND"| vLLM
    Flask -.->|"INFERENCE_BACKEND"| Triton
    Flask --> Prom
    FastAPI --> Prom
    Flask --> Feast
```

**Caption (Figure A.2).** Main container architecture. Flask remains the product surface (UI + academic metrics). FastAPI is a parallel v2 API. Model weights and `evaluation.json` are the two authoritative runtime artifacts.

| Container | Technology | Responsibility |
|-----------|------------|----------------|
| Cinema UI | HTML5, Bootstrap 5, Chart.js | Analyze, compare, metrics, insights, developer portal |
| React SPA | Vite, React 18, TypeScript | Optional `/modern/` surface |
| Flask API | Flask 3, Gunicorn | Inference, explainability, stats, billing, webhooks |
| FastAPI v2 | FastAPI, Uvicorn | Async predict, RAG, agent graph |
| DistilBERT | PyTorch, Transformers | Local sequence classification (`max_length=256`) |
| Evaluation store | JSON / CSV / PNG | Test metrics, CIs, baselines, hypothesis tests |
| Chroma | sentence-transformers | Optional nearest-neighbour reviews |
| Nginx / Ingress | Alpine Nginx, K8s Ingress, Istio | Static hosting and TLS termination |

---

## A.5 Component diagram (C4 Level 3) — Flask backend

```mermaid
flowchart LR
    subgraph Routes["HTTP routes — backend/app.py"]
        R1["/api/predict<br/>/api/predict/stream"]
        R2["/api/explain<br/>/api/aspects"]
        R3["/api/metrics<br/>/api/stats-report<br/>/api/model-comparison"]
        R4["/health<br/>/health/ready"]
        R5["/api/rag/*<br/>/api/agent/analyze"]
    end

    subgraph Services["backend/services/"]
        Inf["inference.py<br/>predict_sentiment<br/>predict_with_backend"]
        XAI["explainability.py<br/>input × gradient"]
        Asp["aspects.py<br/>aspect classifier"]
        RAG["rag.py<br/>Chroma query"]
        Ag["agent_graph.py<br/>validate → predict → RAG → summarize"]
        Keys["api_keys.py / billing.py / webhooks.py"]
    end

    subgraph Core["Shared ML core"]
        Loader["model_loader.py<br/>local weights or HUB_MODEL_FALLBACK"]
        MLCore["ml_core.py<br/>splits, metrics, bootstrap CI,<br/>McNemar, artifact I/O"]
        Obs["observability.py<br/>Prometheus + OTEL"]
    end

    R1 --> Inf
    R2 --> XAI
    R2 --> Asp
    R3 --> MLCore
    R4 --> Loader
    R5 --> RAG
    R5 --> Ag
    Inf --> Loader
    Inf --> MLCore
    XAI --> Loader
    Ag --> Inf
    Ag --> RAG
    Inf --> Obs
```

**Caption (Figure A.3).** Flask components. All prediction paths converge on `model_loader` + `inference`. Statistical endpoints read `evaluation.json` via `ml_core`; they do not invent numbers when artifacts are missing (HTTP 404/503).

---

## A.6 Training and evaluation pipeline

Offline science is a directed acyclic graph invoked by the Makefile. Training uses **train only**. Validation is for monitoring and threshold exploration. **Test metrics are reported once**.

```mermaid
flowchart TB
    HF["Hugging Face IMDB<br/>datasets.load_dataset('imdb')"]
    PP["scripts/data_preprocessing.py<br/>HTML strip · stratified 70/15/15 · seed 42"]
    TrainCSV["data/raw/train.csv  n=35,000"]
    ValCSV["data/raw/val.csv    n=7,500"]
    TestCSV["data/raw/test.csv   n=7,500"]

    Base["scripts/baseline_tfidf.py<br/>TF-IDF + LR / NB / Linear SVM"]
    Train["scripts/model_training.py<br/>DistilBERT AdamW · 3 epochs · max_len 256"]
    LoRA["scripts/lora_finetune.py<br/>optional PEFT comparator"]

    Eval["scripts/evaluate_model.py<br/>metrics · bootstrap 500 · calibration"]
    Err["scripts/error_analysis.py<br/>FP/FN export"]
    Hyp["scripts/hypothesis_tests.py<br/>McNemar · bootstrap Δ · Bonferroni"]
    Abl["scripts/ablation_study.py<br/>max_length / lr / epochs"]
    Sync["scripts/sync_stats_report.py"]

    Art["artifacts/results/evaluation.json"]
    Docs["docs/STATS_REPORT.md"]
    UI["GET /api/metrics · /summary.html"]

    HF --> PP
    PP --> TrainCSV
    PP --> ValCSV
    PP --> TestCSV
    TrainCSV --> Base
    TrainCSV --> Train
    TrainCSV --> LoRA
    Train --> Eval
    Base --> Eval
    ValCSV --> Eval
    TestCSV --> Eval
    Eval --> Art
    Art --> Err
    Art --> Hyp
    Train --> Abl
    Hyp --> Sync
    Sync --> Docs
    Art --> UI
```

**Caption (Figure A.4).** Academic pipeline. `make capstone` executes baseline → train → evaluate → error analysis → insight curves → hypothesis tests → pytest. The test split is not used for model selection.

---

## A.7 Online inference sequence

```mermaid
sequenceDiagram
    autonumber
    actor U as Browser / API client
    participant F as Flask :8000
    participant V as Validators + rate limit
    participant L as model_loader
    participant I as inference.predict_with_backend
    participant M as DistilBERT (local / vLLM / Triton)
    participant C as ml_core.format_single_prediction

    U->>F: POST /api/predict {text}
    F->>V: length, content-type, CSRF origin
    alt rate limited
        V-->>U: 429
    end
    F->>L: get_inference_bundle()
    alt weights missing and FLASK_ENV=development
        L-->>L: HUB_MODEL_FALLBACK (SST-2)
    else production without weights
        L-->>U: 503 inference not ready
    end
    F->>I: predict_with_backend(model, tokenizer, text)
    I->>M: tokenize max_length=256, softmax
    M-->>I: label, P(Fresh), P(Rotten)
    I->>C: format JSON
    C-->>U: {label, sentiment, confidence, probability_positive}
```

**Caption (Figure A.5).** Happy-path inference. Confidence is \(\max(P, 1-P)\). The same truncation length is used in training, evaluation, and serving.

---

## A.8 Explainability and optional agent/RAG path

```mermaid
flowchart TB
    Text["Review text"]
    Pred["DistilBERT logits"]
    Grad["Backprop predicted-class logit<br/>through embeddings"]
    IxG["Element-wise embedding × gradient<br/>sum over hidden dim · L∞ normalise"]
    Tokens["Per-token importance<br/>+ = towards predicted class"]

    Text --> Pred --> Grad --> IxG --> Tokens

    subgraph Optional["Optional product extensions"]
        RAG["Chroma MiniLM<br/>k similar reviews"]
        Agent["LangGraph<br/>validate → predict → RAG → summarize"]
        Aspects["Aspect classifier<br/>acting / plot / visuals / …"]
    end

    Text --> RAG
    Text --> Agent
    Text --> Aspects
    Pred --> Agent
```

**Caption (Figure A.6).** Input × gradient is a first-order, model-derived attribution used by `/api/explain`. The frontend lexicon heatmap is a **separate heuristic** and must not be cited as model attribution. RAG and the LangGraph agent are optional (`RAG_ENABLED`, `AGENT_ENABLED`).

---

## A.9 Deployment topology

```mermaid
flowchart TB
    subgraph Local["Local / Compose"]
        CFront["nginx :8080"]
        CFlask["backend Gunicorn :8000"]
        CFast["fastapi Uvicorn :8001"]
        CFront --> CFlask
        CFast --- CFlask
    end

    subgraph K8s["Kubernetes + Helm"]
        NS["Namespace cinesentiment"]
        DP1["Deployment Flask"]
        DP2["Deployment FastAPI"]
        HPA["HPA CPU/memory"]
        SVC["ClusterIP Services"]
        IG["Ingress / Istio VirtualService"]
        PVC["PVC model + artifacts"]
        NS --> DP1
        NS --> DP2
        DP1 --> HPA
        DP1 --> SVC
        DP2 --> SVC
        SVC --> IG
        DP1 --> PVC
    end

    subgraph Regions["Multi-region overlay"]
        USE["Helm values-us-east.yaml"]
        EUW["Helm values-eu-west.yaml"]
        GEO["geo-ingress.yaml"]
    end

    Local -.->|"docker compose up"| K8s
    K8s --> Regions
```

**Caption (Figure A.7).** Three deployment grades: Compose for demonstration, Helm/Kubernetes for production-style serving, optional multi-region values with Istio mTLS. Health probes use `/health/ready`.

| Target | Entry |
|--------|--------|
| Development | `make serve` → `http://127.0.0.1:8000` |
| Production WSGI | `make serve-prod` (Gunicorn) |
| Compose | `docker compose up` — frontend :8080, Flask :8000, FastAPI :8001 |
| Kubernetes | `deploy/kubernetes/` · `make k8s-validate` |
| Helm | `deploy/helm/cinesentiment/` · `values-us-east.yaml` / `values-eu-west.yaml` |

---

## A.10 CI/CD pipeline

```mermaid
flowchart LR
    Push["push / pull_request<br/>main, develop"]
    Hyg["github-hygiene<br/>block secrets, weights, raw IMDB"]
    Lint["flake8 + black"]
    Sec["bandit + pip-audit"]
    Test["pytest<br/>Python 3.10 / 3.11 / 3.12"]
    K8s["Helm lint + YAML validate"]
    E2E["Playwright Chromium"]
    Dock["docker build"]
    Art["evaluation.json schema check"]

    Push --> Hyg
    Push --> Lint
    Push --> Sec
    Hyg --> Test
    Test --> K8s
    Test --> E2E
    Test --> Art
    Lint --> Dock
    Sec --> Dock
    Test --> Dock
    K8s --> Dock
```

**Caption (Figure A.8).** GitHub Actions workflow `.github/workflows/ci-cd.yml`. Tests inject `HUB_MODEL_FALLBACK` so CI does not require committed DistilBERT weights. Hygiene fails the build if `data/raw/*.csv` or `*.safetensors` are tracked.

---

## A.11 Health and configuration model

| Probe | Semantics |
|-------|-----------|
| `GET /health` | Liveness. Always process-alive; JSON includes `inference_ready`, `model_source`, `model_is_finetuned` |
| `GET /health/ready` | Readiness. HTTP 200 only when prediction is allowed (local weights or explicit hub fallback) |

**Development:** if `sentiment_model/` lacks `model.safetensors` / `pytorch_model.bin` and `FLASK_ENV=development`, the loader selects `HUB_MODEL_FALLBACK` (`distilbert-base-uncased-finetuned-sst-2-english`) so the UI does not present a false “model loading” state.  
**Production:** `SECRET_KEY` is required; CORS allowlist; CSRF on mutating routes; `RATE_LIMIT_*`; CSP + HSTS.

Configuration is environment-driven (`.env.example`). Never commit `.env`.

---

## A.12 Security controls

| Control | Implementation |
|---------|----------------|
| Secrets | `.env` gitignored; hygiene script blocks credentials and API-key registries |
| Transport | TLS at Ingress; Istio `PeerAuthentication` mTLS in-cluster |
| Origin | CORS allowlist; CSRF origin check on POST/PUT |
| Abuse | Per-IP rate limits (`RATE_LIMIT_PER_MINUTE`, `RATE_LIMIT_PREDICT_PER_MINUTE`) |
| Headers | CSP, HSTS (non-dev) |
| Supply chain | Dependabot, pip-audit, CodeQL, Bandit |
| Model files | Weights not stored in git ([MODEL_WEIGHTS.md](MODEL_WEIGHTS.md)) |

---

## A.13 Layer mapping to repository paths

| Layer | Path | Notes |
|-------|------|-------|
| Presentation | `frontend/`, `frontend-react/` | Multi-page cinema UI; optional React SPA |
| Application | `backend/app.py`, `backend/fastapi_app.py` | Dual HTTP surfaces |
| Domain services | `backend/services/` | Inference, XAI, RAG, aspects, billing |
| Statistical core | `backend/ml_core.py` | Metrics, CIs, McNemar, artifact I/O |
| Pipeline | `scripts/` | Train, evaluate, baseline, ablation, RAG index |
| Evidence | `artifacts/results/` | Versioned evaluation for UI and reports |
| Notebooks | `notebooks/` | EDA, error analysis, model comparison |
| Delivery | `deploy/`, `Dockerfile`, `docker-compose.yml` | Compose, K8s, Helm, Triton repo |
| Verification | `tests/`, `e2e/` | pytest + Playwright |

Full tree: [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md).

---

## A.14 Architectural decisions (selected)

| Decision | Rationale | Consequence |
|----------|-----------|-------------|
| DistilBERT over BERT-base | 40% smaller, ~60% faster; sufficient for binary IMDB at capstone compute | Slight capacity trade-off vs full BERT |
| Dual Flask + FastAPI | Flask already serves static UI and academic routes; FastAPI adds typed v2 without breaking examiners’ URLs | Two processes to operate |
| Test split reported once | Prevents inadvertent test-set tuning | Validation used only for monitoring |
| Bootstrap percentile CI (500) | Non-parametric; no normality assumption on accuracy | Wider intervals than analytic binomial CIs |
| Honest non-significance | McNemar p ≈ 0.15 vs TF-IDF | DistilBERT is shipped for product flexibility, not a claimed significant win |
| Hub fallback in development | UI remains demonstrable without 250+ MB weights in git | Production must set weights or an explicit fallback |

---

## A.15 Related documents

| Document | Role |
|----------|------|
| [METHODOLOGY.md](METHODOLOGY.md) | Experimental protocol, related work, ablation |
| [STATS_REPORT.md](STATS_REPORT.md) | Authoritative test metrics and hypothesis tests |
| [MODEL_CARD.md](MODEL_CARD.md) | Intended use and limitations |
| [SILICON_VALLEY_STACK.md](SILICON_VALLEY_STACK.md) | MLflow, RAG, K8s, Istio extensions |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Operator runbooks |
| [openapi.yaml](openapi.yaml) | HTTP contract |
| README §3 | AI/ML figures M.1–M.12 (use-case through module diagram) |

---

# Part B — AI and ML architecture

CS-style views of every machine-learning function that exists in the tree. README §3 renders Figures **M.1–M.12**. This part records **wiring rules**, extra state/data-flow diagrams, and what is *not* claimed.

## B.1 Inventory (mapped to code)

| Concern | Code | Serve path? |
|---------|------|-------------|
| DistilBERT IMDB classifier | `scripts/model_training.py`, `sentiment_model/` | Yes — Flask, FastAPI |
| TF-IDF LR / NB / SVM | `scripts/baseline_tfidf.py` | No — evaluation artefact only |
| LoRA PEFT | `scripts/lora_finetune.py`, `sentiment_model_lora/` | No |
| LLM zero-shot | `scripts/llm_baseline.py` | No |
| Input × gradient XAI | `backend/services/explainability.py` | Yes — `/api/explain` |
| Aspect polarity | `aspects.py`, `aspect_classifier.py` | Yes — `/api/aspects`, analyze |
| Tone arc | sentence split + per-sentence predict | Yes — analyze `arc` |
| Multilingual XLM-R | `multilingual.py`, `language.py` | Yes — if lang ≠ en |
| RAG MiniLM + Chroma | `rag.py`, `scripts/index_rag.py` | Optional `RAG_ENABLED` |
| LangGraph agent | `agent_graph.py` | Optional `AGENT_ENABLED` |
| Remote vLLM / Triton | `remote_inference.py` | FastAPI + agent only |
| Feast text stats | `feature_store.py` | `/api/features` — not a model input |
| MLflow / W&B | `experiment_tracking.py` | Train jobs only |

## B.2 Wiring rules (read before drawing)

1. Flask `/api/predict` and `/api/analyze` call `predict_sentiment` (local HF) and may route non-English to XLM-R. They do **not** read `INFERENCE_BACKEND`.
2. FastAPI `/api/v2/predict` and LangGraph `predict` call `predict_with_backend`.
3. RAG output is never concatenated into DistilBERT tokens or logits.
4. LoRA adapters and GPT-4o-mini baselines are offline comparators.
5. Triton `deploy/triton/model_repository/.../model.py` is a lexicon smoke backend unless replaced.
6. There is **no MCP (Model Context Protocol) server** in this repository. External agents should use the REST API (`docs/openapi.yaml`).

## B.3 Figure index M.1–M.12

Reproduced with captions in README §3.

| Figure | CS type | Subject |
|--------|---------|---------|
| M.1 | Use case | All AI-facing functions |
| M.2 | Layered | Presentation → ML → loader → evidence |
| M.3 | Neural block | DistilBERT encoder + 2-way head |
| M.4 | Family / package | Served models vs offline comparators |
| M.5 | Activity | Language + backend routing |
| M.6 | Sequence | Composite `/api/analyze` |
| M.7 | Data flow | RAG index vs query |
| M.8 | State | LangGraph linear graph |
| M.9 | Activity | Aspects + tone arc |
| M.10 | Data flow | Input × gradient |
| M.11 | Deployment-ish | MLflow / W&B / Feast |
| M.12 | Class / module | `backend/` ML units |

## B.4 Model-loader state (extra)

```mermaid
stateDiagram-v2
    [*] --> ProbeLocal: get_inference_bundle()
    ProbeLocal --> ReadyLocal: model.safetensors or pytorch_model.bin
    ProbeLocal --> HubFallback: no weights and development or HUB_MODEL_FALLBACK set
    ProbeLocal --> Untrained: ALLOW_UNTRAINED_BASE
    ProbeLocal --> Failed: production, no weights, no fallback
    HubFallback --> ReadyHub: SST-2 distilbert loaded
    HubFallback --> Failed: download / import error
    ReadyLocal --> [*]
    ReadyHub --> [*]
    Untrained --> [*]
    Failed --> [*]: HTTP 503
```

**Figure M.13.** Loader states (`backend/model_loader.py`). Production without weights must fail closed. Development may serve `distilbert-base-uncased-finetuned-sst-2-english` so the UI is not stuck on “model loading”.

## B.5 Level-1 data flow (extra)

```mermaid
flowchart LR
    IMDB["IMDB HF dataset"] --> Pre["preprocess 70/15/15"]
    Pre --> TrainFit["fit DistilBERT + TF-IDF"]
    TrainFit --> Weights["sentiment_model/"]
    TrainFit --> Eval["evaluation.json"]
    Weights --> API["Flask / FastAPI"]
    Eval --> Dash["Metrics / Statistics UI"]
    User["Review text"] --> API
    API --> User
    API -.-> RAG["Chroma optional"]
    API -.-> Feat["Feast optional"]
```

**Figure M.14.** Level-1 data flow. Two stores of truth: weights (for labels) and `evaluation.json` (for reported metrics). Dotted edges are optional product extensions.

## B.6 Training sequence with tracking (extra)

```mermaid
sequenceDiagram
    participant Make as make train
    participant Scr as model_training.py
    participant Track as experiment_run
    participant HF as HuggingFace Trainer
    participant Disk as sentiment_model/

    Make->>Scr: train.csv + val.csv
    Scr->>Track: start cinesentiment-distilbert
    Scr->>HF: AdamW 2e-5, max_len 256, F1 best
    HF-->>Scr: checkpoint
    Scr->>Disk: tokenizer + weights
    Scr->>Track: log test F1, params, confusion PNG
    Track-->>Make: MLflow and optional W and B
```

**Figure M.15.** Train-job sequence. Tracking is a side effect of training, not of `/api/predict`. Disable with `MLFLOW_ENABLED=false` and `WANDB_MODE=disabled`.

## B.7 AI-specific decisions

| Decision | Rationale | Consequence |
|----------|-----------|-------------|
| Linear LangGraph, not a ReAct loop | Capstone needs a deterministic demo graph | No tool-selection; RAG always attempted |
| RAG as neighbour display | Avoid claiming retrieval-augmented *accuracy* without an ablation | Neighbours are UX/context |
| Aspects via lexicon + optional TF-IDF | A second transformer head is disproportionate | Aspect quality tracks keyword coverage |
| XAI = input × gradient | Interactive latency; IG/SHAP too slow for the API | First-order saliency only |
| Dual Flask vs FastAPI inference entry | Preserve examiner URLs on :8000 | Remote backends easy to miss on Flask |

---

*Architecture version 2.3.0. Part A: C4 software views. Part B: CS diagrams of the ML system as implemented.*
