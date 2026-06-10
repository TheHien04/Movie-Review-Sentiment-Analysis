# GitHub push checklist

Run before `git push` to a **public** repository.

## 1. Secrets

```bash
make github-check
```

- [ ] `.env` is **not** tracked (`git ls-files .env` should be empty)
- [ ] No API keys, passwords, or tokens in code
- [ ] Enable **GitHub Secret Scanning** + **Dependabot** in repo Settings → Security

## 2. What is safe to commit

| Commit | Do not commit |
|--------|----------------|
| Code, tests, docs | `.env`, `venv/`, `*.log` |
| `data/samples/*.csv` | Full IMDB `data/raw/` (large) |
| `artifacts/results/evaluation.json` | `*.safetensors`, `*.bin` weights |
| Tokenizer config in `sentiment_model/` | Trained weight files |

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
