# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 2.0.x   | Yes       |
| < 2.0   | No        |

## Reporting a vulnerability

**Please do not open public GitHub issues for security problems.**

1. Email maintainers with subject `SECURITY: CineSentiment` (use your course contact or repository owner).
2. Include steps to reproduce, impact assessment, and affected version (`VERSION` file).
3. Allow up to **7 business days** for an initial response.

We will coordinate disclosure and credit researchers who report valid issues responsibly.

## Security controls (summary)

- **Secrets:** Never commit `.env`. Production requires `SECRET_KEY` (see `.env.example`).
- **Transport:** HSTS + CSP in non-development mode (`backend/app.py`).
- **Input:** Text length limits, CSV extension whitelist, `secure_filename` on uploads.
- **Rate limiting:** Configurable per-IP limits on predict/compute endpoints.
- **CORS:** Allowlist via `ALLOWED_ORIGINS`.
- **CSRF:** Origin check on state-changing API requests.
- **Container:** Non-root `appuser` in Dockerfile.
- **Dependencies:** CI runs Bandit + pip-audit on every PR; Dependabot weekly updates.
- **Supply chain:** Hugging Face hub loads use `HF_MODEL_REVISION` (default `main`); local weights use `local_files_only=True`.

## Safe defaults for public deployment

```bash
cp .env.example .env
# Generate: python -c "import secrets; print(secrets.token_hex(32))"
export SECRET_KEY=<generated>
export FLASK_ENV=production
export DEBUG=False
export RATE_LIMIT_ENABLED=True
```

Do **not** set `ALLOW_UNTRAINED_BASE=true` in production.

## Model weights

Fine-tuned weights are **not** stored in git (see `.gitignore`). Use `make train` or `HUB_MODEL_FALLBACK` for demos only — document which model serves predictions in your deployment README.
