# Release checklist (v1.6.0)

Use this before tagging a GitHub release or submitting the course project.

## 1. Environment

- [ ] Python 3.9+
- [ ] `make install`
- [ ] Copy `.env.example` → `.env` (set `SECRET_KEY` in production)

## 2. Data & model

- [ ] `data/raw/{train,val,test}.csv` present (or `make preprocess`)
- [ ] `make train` or `make train-fast` completed
- [ ] `sentiment_model/` contains `model.safetensors` or `pytorch_model.bin`
- [ ] `make evaluate` → `artifacts/results/evaluation.json` exists

## 3. Quality gates

- [ ] `make test` — all tests pass
- [ ] `make lint` — no syntax errors
- [ ] Open http://127.0.0.1:8000 — Home, **Statistics**, Metrics, Insights, Dataset load
- [ ] `/health` shows `model_is_finetuned: true`

## 4. Repository hygiene

- [ ] No `backend/.venv/` or `venv/` committed
- [ ] No `.env` with secrets committed
- [ ] README metrics match `evaluation.json` (test split)

## 5. Deploy (optional)

- [ ] Docker: `docker compose up --build`
- [ ] Gunicorn + `DEBUG=False`
- [ ] Model weights mounted or baked into image

## Tag release

```bash
git tag -a v1.0.0 -m "IMDB DistilBERT sentiment release"
git push origin v1.0.0
```

Attach **model weights** as a release asset if not using Git LFS (see README).
