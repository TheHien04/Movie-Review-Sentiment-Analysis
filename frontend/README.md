# Frontend

Multi-page static UI served by Flask (`backend/app.py` → `frontend/`).

## Conventions

| Pattern | Purpose |
|---------|---------|
| `data-page` on `<body>` | Active nav link (`layout.js`) |
| `data-cinema-nav` / `data-cinema-footer` | Injected chrome |
| `window.apiUrl(path)` | Same-origin API (`config.js`) |
| `*-page.js` | Page-specific data fetching & render |
| `integrate-utils.js` | Analyze page: loading, toast, batch, XAI |

## Pages

| File | `data-page` | Controller | Purpose |
|------|-------------|------------|---------|
| `index.html` | `home` | `home-status.js`, `home-stats.js` | Landing, pricing |
| `batch.html` | `analyze` | `main.js`, `integrate-utils.js` | Single + batch predict |
| `compare.html` | `compare` | `compare-page.js` | A/B review comparison |
| `evaluation.html` | `evaluation` | `evaluation-page.js` | Metrics dashboard |
| `summary.html` | `summary` | `summary-page.js` | Statistics report |
| `insights.html` | `insights` | `insights-page.js` | ROC / calibration |
| `dataset.html` | `dataset` | `dataset-page.js` | IMDB explorer |
| `checklist.html` | `checklist` | `checklist-page.js` | Ops / capstone health |
| `api-docs.html` | `api-docs` | Swagger UI | REST reference |

## CSS load order (every page)

1. `design-system.css` — tokens, focus, a11y
2. `cinema-theme.css` — brand, hero, nav
3. `theme.css` — light/dark variables
4. Page CSS (`batch.css`, `data-viz.css`, …)
5. `layout-polish.css` — grids, pricing, tables
6. `cinema-unified.css` — cross-page polish

## Shared scripts

Load on most pages: `layout.js` (immediately after `<nav>`), `config.js`, `ui-messages.js`, `theme.js`.

Analyze page additionally: `history.js`, `validation.js`, `explainable-ai.js`, `usage-meter.js`.

## Status indicator (home)

`home-status.js` polls `GET /health` and shows:

- Green dot — `inference_ready: true`
- Yellow — model loaded but blocked (rare after dev auto-fallback)
- Red — server unreachable (auto-retry)
