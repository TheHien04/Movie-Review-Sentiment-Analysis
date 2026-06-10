# GitHub push checklist

Run before `git push` to a **public** repository.

## 1. Automated gate (run before every push)

```bash
make github-check
```

This runs `scripts/verify_github_push.sh` then pytest. The hygiene script **fails** if any of these are tracked:

| Blocked | Why |
|---------|-----|
| `.env`, `credentials.json`, `secrets.json` | Secrets |
| `data/api_keys_registry.json` | Provisioned API keys |
| `data/raw/*.csv` | Full IMDB (~65 MB) — regenerate with `make preprocess` |
| `*.safetensors`, `*.pth`, `*.bin` | Model weights |
| `venv/`, `node_modules/`, `__pycache__/` | Local tooling |
| Tracked files **> 5 MB** (except `Images/` screenshots) | Repo bloat |

Also enable **GitHub Secret Scanning** + **Dependabot** in repo Settings → Security.

## 2. What professionals commit vs keep local

| Safe to commit | Keep local / regenerate |
|----------------|-------------------------|
| Code, tests, docs, CI workflows | `.env` (copy from `.env.example`) |
| `data/samples/*.csv` (5 rows) | `data/raw/{train,val,test}.csv` via `make preprocess` |
| Tokenizer config in `sentiment_model/` | `sentiment_model/*.safetensors` after `make train` |
| `artifacts/results/evaluation.json` (optional) | `artifacts/mlruns/`, `wandb/`, `logs/` |
| `Images/` UI screenshots | `data/feast/*.parquet` via `make feast-materialize` |

## 3. CI on GitHub

Workflows in `.github/workflows/`:

- **ci-cd.yml** — lint, Bandit, pytest (3.10–3.12), Docker build
- **codeql.yml** — static analysis (weekly + on PR)

Forks get green CI without Docker Hub secrets.

## 4. Production deployment (if you host a demo)

```bash
export SECRET_KEY=$(python -c "import secrets; print(secrets.token_hex(32))")
export FLASK_ENV=production
export DEBUG=False
export RATE_LIMIT_ENABLED=True
```

See [SECURITY.md](../SECURITY.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

## 5. Recommended repo settings

- Default branch: `main`
- Branch protection: require PR + passing CI
- Add topics: `nlp`, `sentiment-analysis`, `distilbert`, `flask`, `machine-learning`
- README screenshot: home page at `http://127.0.0.1:8000`

## 6. First push

```bash
make install
make github-check
git add -A
git status   # verify no .env or weights
git commit -m "Prepare public release"
git remote add origin https://github.com/YOUR_USER/Movie-Review-Sentiment-Analysis.git
git push -u origin main
```
