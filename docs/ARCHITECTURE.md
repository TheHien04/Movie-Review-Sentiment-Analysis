# Architecture

## System context

```
┌─────────────┐     HTTPS      ┌──────────────────────────────────┐
│   Browser   │ ◄────────────► │  Flask (Gunicorn in production)     │
│  frontend/  │   /api/*       │  backend/app.py                   │
└─────────────┘                │    ├─ services/inference.py       │
                               │    ├─ services/explainability.py  │
                               │    └─ ml_core.py (metrics/stats)  │
                               └──────────────┬─────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
            sentiment_model/        artifacts/results/          data/raw/
            (DistilBERT weights)      evaluation.json             IMDB CSVs
```

## Inference path

1. `POST /api/predict` → validate input → `services.inference.predict_sentiment`
2. DistilBERT tokenizer + model (local IMDB weights or hub fallback)
3. `ml_core.format_single_prediction` → JSON (`label`, `confidence`, `sentiment`)

## Evaluation & statistics

Offline pipeline (`make evaluate`, `make hypothesis-tests`) writes `artifacts/results/evaluation.json`.

Online API (`/api/stats-report`, `/api/metrics`) reads artifacts; optional live recompute with row caps.

## Health model

| Endpoint | Use |
|----------|-----|
| `GET /health` | Liveness + `inference_ready`, `inference_message` |
| `GET /health/ready` | K8s readiness (200 only when predict allowed) |

**Dev behavior:** If `sentiment_model/` lacks `model.safetensors` / `pytorch_model.bin`, local `FLASK_ENV=development` auto-selects `HUB_MODEL_FALLBACK` so the UI never shows a false “model loading” state.

## Security (production)

- `SECRET_KEY` required when `FLASK_ENV=production`
- CORS allowlist, CSRF origin check on mutating routes
- Rate limits per IP (`RATE_LIMIT_*`)
- CSP + HSTS headers (non-dev)

## CI/CD

GitHub Actions: lint → pytest with `HUB_MODEL_FALLBACK` (see `tests/conftest.py`) → Docker build.
