# Demo script — Statistics coursework defense (~5 minutes)

Use with **`make serve`** → http://127.0.0.1:8000

---

## 0. Setup (before presenting)

```bash
make capstone
make serve
```

Open tabs: **Statistics** · **Metrics** · **Insights** · notebook HTML in `artifacts/results/` (optional)

---

## 1. Problem & data (45 s)

> "We predict binary sentiment on IMDB reviews: Fresh (positive) vs Rotten (negative).  
> Data are split **70% train / 15% validation / 15% test**, stratified with seed 42.  
> The **test set is held out** and only used for final reporting."

**Show:** `/summary.html` → Evaluation protocol section.

---

## 2. Primary statistical results (90 s)

> "On **n = 7,500** test reviews, DistilBERT at threshold 0.5 achieves about **91.8% accuracy and F1**.  
> Bootstrap **95% confidence intervals** (500 resamples) are shown under each metric—for example F1 is roughly 91.1%–92.4%."

**Show:** Statistics page → Primary results (test split) + Derived classification rates table.

**Talking point:** Sensitivity ≈ recall for positive class; specificity from confusion matrix.

---

## 3. Baseline comparison (45 s)

> "We compare against **TF-IDF + logistic regression** on the **same test split**.  
> Delta is DistilBERT minus baseline; positive delta means the transformer improves that metric."

**Show:** Model comparison table on Statistics page.

## 3b. Hypothesis tests (45 s)

> "We run **McNemar** on paired errors and a **bootstrap difference test** on accuracy and F1.  
> If p &lt; 0.05, the improvement over the baseline is statistically supported at α = 0.05."

**Show:** Statistics page → Hypothesis tests section (after `make hypothesis-tests`).

---

## 4. Curves & calibration (90 s)

> "**ROC-AUC** measures ranking quality independent of threshold.  
> **Precision–recall** and **average precision** summarize performance across thresholds.  
> **Calibration** checks whether predicted probabilities match observed frequencies—Brier score and ECE summarize miscalibration."

**Show:** `/insights.html` — ROC, PR, **calibration (reliability diagram)**. Toggle **test** split.

---

## 5. Confusion matrix & errors (45 s)

> "At threshold 0.5 we have about **325 false positives** and **293 false negatives** on test.  
> Error analysis samples help explain *why* the model fails—mixed sentiment, sarcasm, etc."

**Show:** `/evaluation.html` — confusion matrix, error analysis viewer (2–3 FP/FN cards).

---

## 6. Live prediction (optional, 30 s)

**Show:** Analyze page — demo chip → confidence and probability.

> "This is inference only; it does not change our reported test statistics."

---

## 6b. Limitations slide (45 s) — **required for honest defense**

**Show:** `docs/DEFENSE_SLIDE_LIMITATIONS.md` (or export to slide)

> "McNemar **p ≈ 0.15** — we do **not** claim DistilBERT significantly beats TF-IDF at α = 0.05.  
> We still deploy DistilBERT for **probabilities, explainability, and product extensions**; TF-IDF remains our statistical control."

---

## 7. Closing (30 s)

> "We followed a fixed protocol: train on train only, report **test** metrics with **bootstrap CIs**, compare to a classical baseline, and report **ROC, PR, and calibration** for a complete statistical picture.  
> Reproducibility: `artifacts/results/capstone_run_log.json` after `make capstone`.  
> Full write-up: `docs/STATS_REPORT.md` and `docs/METHODOLOGY.md`."

---

## Q&A cheat sheet

| Question | Answer |
|----------|--------|
| Why bootstrap CI? | Non-parametric uncertainty for metrics; no normality assumption on F1. |
| Why test split? | Unbiased estimate of generalization; val used for monitoring only. |
| Why both accuracy and F1? | Balanced classes → both informative; F1 emphasizes positive class agreement. |
| Calibration vs accuracy? | High accuracy with poor calibration → probabilities misleading for risk decisions. |
| McNemar not significant — why DistilBERT? | Tied on accuracy; transformer gives calibrated probs, single stack for API/XAI/multilingual. See limitations slide. |
| TF-IDF enough? | For IMDB at this metric, competitive — valid finding. Our value = protocol + production path. |

---

**Keyboard shortcuts:** `?` help · `g` then `s` statistics · `g` `m` metrics · `g` `i` insights
