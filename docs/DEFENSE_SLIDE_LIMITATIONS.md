# Defense slide — Limitations & model choice

**Use as one slide** before Q&A. Honest statistics + clear engineering rationale.

---

## Slide title

**Limitations — and why we still ship DistilBERT**

---

## Left column: What the tests say

| Finding | Value | Interpretation |
|---------|-------|----------------|
| McNemar (paired errors) | **p ≈ 0.15** | Not significant at α = 0.05 |
| Bootstrap ΔF1 | **+0.47 pp**, p ≈ 0.23 | Interval includes zero |
| Bootstrap Δ accuracy | **+0.50 pp**, p ≈ 0.13 | Interval includes zero |

**Talking point (30 s):**

> "On the held-out test set, DistilBERT and TF-IDF+logistic are **statistically tied** at α = 0.05. We report that honestly — we do **not** claim a significant win from McNemar alone."

---

## Right column: Why DistilBERT anyway?

1. **Same ballpark accuracy** (~91.8% vs ~91.2%) with room for **domain fine-tuning** (new genres, languages).
2. **Single neural encoder** powers explainability (`/api/explain`), tone arc, and multilingual extension — one stack, not three pipelines.
3. **Probability outputs** enable calibration curves, threshold tuning, and confidence UI — not just hard labels.
4. **Transfer learning** is the industry default for text; classical baseline remains our **sanity check** and coursework comparator.

**Talking point (30 s):**

> "We choose DistilBERT for **product and research flexibility**, not because hypothesis tests proved dominance. The baseline anchors our statistical story; the transformer anchors deployment."

---

## Footer bullets (limitations — always disclose)

- **Domain:** IMDB English reviews only; sarcasm / social text not validated.
- **Explainability:** Gradient-based tokens ≠ causal explanation; lexicon fallback is didactic only.
- **Compute:** Training and inference cost >> TF-IDF; trade-off documented in ablation.
- **v2 features** (aspects, multilingual): demo extensions — not all re-validated on full test protocol.

---

## If examiner asks: "So TF-IDF is enough?"

> "For **this dataset and metric**, classical ML is competitive — that's a valid scientific finding. Our contribution is a **reproducible protocol** (splits, CIs, paired tests, error analysis) plus a **production path** (API, monitoring, tests). DistilBERT is the deployable model; TF-IDF is the statistical control."

---

**Evidence files:** `docs/STATS_REPORT.md` §9 · `artifacts/results/capstone_run_log.json` · `/summary.html`
