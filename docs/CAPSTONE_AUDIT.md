# Capstone audit — all pillars at target level 5

**Version:** 2.0.0 · **Updated:** 2026-06-10 (v2 platform + stats coursework alignment)

| Pillar | Score | Status |
|--------|-------|--------|
| UI/UX | **5.0** | Cinema theme, live preview, voice input, keyboard shortcuts, mobile nav |
| Data Product | **5.0** | REST API v2, Developer portal, webhooks, SSE batch, artifacts |
| DS / DA | **5.0** | DistilBERT + TF-IDF baselines, aspect ML, multilingual, error analysis |
| Thống kê | **5.0** | Bootstrap CI, McNemar, effect sizes, Bonferroni, `STATS_REPORT.md`, EDA |
| SE | **5.0** | 78 tests, CI/CD, Docker, `make capstone`, OpenAPI 3.0, security hardening |

---

## One-command pipeline

```bash
make install
make capstone   # baseline → train → evaluate → error-analysis → insights-curves → hypothesis-tests → sync-docs → test → release-check
make serve
```

Individual steps: `make baseline`, `make train`, `make evaluate`, `make error-analysis`, `make hypothesis-tests`, `make sync-docs`.

---

## Coursework (môn Học Thống Kê) — evidence map

| Requirement | Where to cite |
|-------------|---------------|
| Research question + protocol | `docs/STATS_REPORT.md` §1–2 |
| Test metrics + 95% bootstrap CI | `summary.html` · `docs/STATS_REPORT.md` §3 |
| Confusion matrix + derived rates | `summary.html` · `evaluation.json` |
| Baseline comparison (TF-IDF) | Metrics page · `STATS_REPORT.md` §5 |
| Hypothesis tests (McNemar, bootstrap Δ) | `summary.html` · `hypothesis_tests` in JSON |
| Effect sizes + Bonferroni | `summary-page.js` · `hypothesis_tests` artifact |
| EDA | `notebooks/01_eda_imdb.ipynb` |
| Error analysis (FP/FN) | `notebooks/02_error_analysis.ipynb` |
| Model comparison + stats | `notebooks/03_model_comparison.ipynb` |
| Qualitative errors (FP/FN) | `artifacts/results/error_analysis_test.csv` |

---

## Artifacts

| File | Purpose |
|------|---------|
| `artifacts/results/evaluation.json` | Val/test metrics, baselines, hypothesis_tests |
| `artifacts/results/error_analysis_test.csv` | Misclassified test reviews (qualitative) |
| `artifacts/results/baselines/tfidf_logistic.joblib` | Reproducible baseline model |
| `docs/STATS_REPORT.md` | Printable báo cáo thống kê (auto-sync via `make sync-docs`) |
| `notebooks/01_eda_imdb.ipynb` | EDA for báo cáo |
| `notebooks/02_error_analysis.ipynb` | FP/FN charts + defense samples |
| `notebooks/03_model_comparison.ipynb` | Baselines, CI, McNemar tables |
| `artifacts/results/*.html` | Exported notebooks (`make notebooks`) |

---

## v2.0 platform (beyond coursework minimum)

- **Developer API** — `/api/developer/me`, API keys, usage limits
- **Stripe billing** — demo Pro keys when Stripe unset
- **Webhooks** — `batch.complete` HMAC-SHA256
- **Multilingual** — auto language detect + XLM-RoBERTa fallback
- **Aspect ML** — `/api/aspects`, trained classifier (`make aspect-train`)
- **SSE streaming** — `POST /api/predict/stream` for large CSV

---

## Defense checklist

- [ ] `make capstone` completed — **Defense** page shows green checks
- [ ] Báo cáo cites **test** split from `evaluation.json` (not validation)
- [ ] Bảng so sánh DistilBERT vs TF-IDF (Metrics or Statistics page)
- [ ] **McNemar / bootstrap difference** reported with honest interpretation
- [ ] 2–3 ví dụ FP/FN từ `error_analysis_test.csv`
- [ ] Slide: lexicon heatmap ≠ gradient-based `/api/explain`
- [ ] `make test` — 78/78 passing before demo
- [ ] `artifacts/results/capstone_run_log.json` present after `make capstone`
- [ ] Limitations slide rehearsed — [DEFENSE_SLIDE_LIMITATIONS.md](DEFENSE_SLIDE_LIMITATIONS.md)

---

*Scores assume full `make train` completed; `train-fast` acceptable if labeled in report.*
