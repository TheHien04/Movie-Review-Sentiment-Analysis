# Statistical & ML Methodology

> **CineSentiment** — Binary Sentiment Classification on IMDB Movie Reviews  
> Capstone-level documentation for Data Science coursework.  
> Theory-to-artefact diagrams: [THEORY.md](THEORY.md) (Figures T.1–T.16).

---

## 1. Problem Statement

Movie reviews posted online carry implicit sentiment that can be quantified.
We frame the task as **binary classification**: given a review text \(x\), predict
a label \(y \in \{0, 1\}\) where 0 = *negative* and 1 = *positive*.

**Research questions:**

1. Can a fine-tuned transformer (DistilBERT) significantly outperform classical
   ML baselines (TF-IDF + Logistic Regression, Naive Bayes, SVM) on held-out
   test data?
2. Which hyperparameters (sequence length, learning rate, training epochs) have
   the largest effect on model performance (ablation study)?
3. How well-calibrated are the predicted probabilities, and do the two model
   families differ in calibration quality?

## 2. Related Work

| Reference | Contribution |
|-----------|-------------|
| Maas et al. (2011) | IMDB review dataset (50 k reviews); established sentiment benchmarks. |
| Devlin et al. (2019) | BERT pre-training; contextual word representations. |
| Sanh et al. (2019) | DistilBERT: 40 % smaller, 60 % faster, retaining 97 % of BERT performance. |
| Pang & Lee (2008) | Foundational survey on opinion mining and sentiment analysis. |

Live explainability in this repo is **input × gradient**, not LIME/SHAP. Those papers are background only; do not cite them as methods used.

## 3. Data Protocol

| Split | Share (per class) | File | Purpose |
|-------|-------------------|------|---------|
| Train | 70 % | `data/raw/train.csv` | Fit model parameters only |
| Validation | 15 % | `data/raw/val.csv` | Threshold tuning, early stopping |
| Test | 15 % | `data/raw/test.csv` | **Final** reporting (touched once) |

- **Source:** IMDB via Hugging Face `datasets.load_dataset("imdb")`.
- **Preprocessing:** HTML tag removal; stratified split by label (`scripts/data_preprocessing.py`, seed = 42).
- **Class balance:** The original IMDB set is balanced (50/50); stratified splitting preserves this.
- **No mock metrics** in the API: endpoints return HTTP 404/503 when data or weights are missing.

### 3.1 Exploratory Data Analysis

Three Jupyter notebooks support the written report (`make notebooks` exports HTML):

| Notebook | Content |
|----------|---------|
| `01_eda_imdb.ipynb` | Class balance, text/token length, vocabulary, word clouds, Jaccard overlap, data quality |
| `02_error_analysis.ipynb` | FP/FN counts, confidence on errors, defense examples, `error_defense_samples.csv` |
| `03_model_comparison.ipynb` | DistilBERT vs TF-IDF baselines (+ optional LoRA), bootstrap CI, McNemar, comparison charts |

`01_eda_imdb.ipynb` specifically provides:

- Class-distribution bar charts across all splits
- Text-length and word-count distributions by class
- Token-length analysis (showing truncation impact at 256 tokens)
- Top unigrams and bigrams per class
- Word clouds for positive / negative reviews
- Vocabulary overlap (Jaccard similarity)
- Data-quality checks (missing values, duplicates)

## 4. Models

### 4.1 Primary: DistilBERT

- **Architecture:** `distilbert-base-uncased` + sequence classification head (2 labels).
- **Loss:** Cross-entropy on training labels.
- **Sequence length:** `MAX_SEQUENCE_LENGTH` (default 256, env var) — same truncation in training, evaluation, and API inference.
- **Decision rule:** \(\hat{y} = \mathbb{1}[P(y{=}1) \geq \tau]\), default \(\tau = 0.5\).
- **Optimizer:** AdamW, weight decay 0.01, linear warmup.

### 4.2 Baselines (identical splits, same pre-processing)

| Model | Key parameters |
|-------|---------------|
| TF-IDF + Logistic Regression | `max_features=50 000`, `ngram_range=(1,2)`, `sublinear_tf`, balanced class weight |
| TF-IDF + Multinomial Naive Bayes | `alpha=1.0` (Laplace smoothing) |
| TF-IDF + Linear SVM | `CalibratedClassifierCV(LinearSVC, cv=3)` for probability estimates |

All baselines are trained and evaluated by `scripts/baseline_tfidf.py`; results are merged into `artifacts/results/evaluation.json` under `baselines.*`.

## 5. Evaluation Metrics

On a held-out split with true labels \(y_i\) and predicted labels \(\hat{y}_i\):

| Metric | Definition |
|--------|-----------|
| Accuracy | \(\frac{TP + TN}{TP + TN + FP + FN}\) |
| Precision | \(\frac{TP}{TP + FP}\) |
| Recall | \(\frac{TP}{TP + FN}\) |
| F1 | Harmonic mean of precision and recall |
| ROC-AUC | Area under ROC curve |
| Brier Score | Mean squared error of probability estimates |
| ECE | Expected Calibration Error (10 bins) |
| Confusion matrix | Counts for \((y, \hat{y}) \in \{0,1\}^2\) |

`zero_division=0` when a class is never predicted (reported honestly).

### 5.1 Bootstrap Confidence Intervals

- **Method:** Percentile bootstrap (500 resamples, seed = 42) on the evaluation split.
- **Reported:** 95 % CI (2.5th and 97.5th percentiles) for each metric.
- **Implementation:** `backend/ml_core.py` → exposed via `/api/metrics?recompute=true`.

### 5.2 Calibration

- Reliability diagram (10 bins) comparing predicted probability vs. observed frequency.
- Brier score and ECE reported alongside discrimination metrics.
- Generated by `scripts/evaluate_model.py`.

## 6. Hypothesis Tests (Paired Model Comparison)

After training all models, run `make hypothesis-tests`:

| Test | Purpose |
|------|---------|
| **McNemar's test** | Whether DistilBERT and TF-IDF make significantly different paired errors (continuity-corrected χ², α = 0.05) |
| **Bootstrap difference** | Whether mean accuracy/F1 difference (DistilBERT − baseline) is significantly ≠ 0 (500 resamples, two-sided) |

- Results stored in `evaluation.json` → `hypothesis_tests.test`.
- **Effect size:** Cohen's h and odds ratio for discordant pairs — computed in `compare_classifiers_hypothesis()` and stored in `hypothesis_tests.*.effect_sizes`.
- **Multiple comparisons:** Bonferroni correction across all McNemar + bootstrap tests when comparing > 1 baseline (`multiple_comparison_correction` in artifact).

## 7. Ablation Study

`scripts/ablation_study.py` systematically varies one hyperparameter at a time while holding others at default:

| Axis | Values tested | Default |
|------|---------------|---------|
| `max_length` | 64, 128, 256, 512 | 256 |
| `learning_rate` | 1e-5, 2e-5, 5e-5, 1e-4 | 2e-5 |
| `epochs` | 1, 2, 3, 5 | 3 |

Results saved to `artifacts/results/ablation_results.json` and printed as a comparison table.

## 8. Interpretability

### 8.1 Model-Derived: Input × Gradient

The `/api/explain` endpoint computes token-level importance via input × gradient:
1. Forward pass through DistilBERT embeddings
2. Backpropagate gradient of the predicted-class logit
3. Element-wise product of embedding and gradient, summed over hidden dim
4. Normalize by max absolute value

This produces a per-token importance score: positive = pushes toward predicted class, negative = pushes away.

### 8.2 Lexicon Heuristic (Fallback)

When the model is unavailable, the frontend uses a rule-based lexicon (`frontend/explainable-ai.js`) to color words. This is clearly labelled "lexicon heuristic" in the UI and not presented as model output.

## 9. Reproducibility

### 9.1 Commands

```bash
make install          # install all dependencies
make preprocess       # regenerate data/raw from IMDB
make train            # fine-tune DistilBERT
make baseline         # train all classical baselines
make evaluate         # re-score val/test
make hypothesis-tests # paired statistical tests
make ablation         # hyperparameter ablation study
make eda              # execute + export EDA notebook
make test             # unit tests
make serve            # launch API server
```

### 9.2 Seeds & Determinism

- All random operations use `seed=42` (NumPy, scikit-learn, PyTorch, HF Trainer).
- Data splits are stratified and deterministic.
- `requirements-lock.txt` (generated via `make lock-deps`) pins exact dependency versions.

## 10. API Honesty

| Endpoint | Data source |
|----------|-------------|
| `/api/dataset-info` | Measured from CSV row counts |
| `/api/metrics` | `artifacts/results/evaluation.json` or live recompute |
| `/api/predict` | Model inference; `confidence` = max class probability |
| `/api/explain` | Input × gradient token importance |
| `/api/model-comparison` | Aggregated from evaluation.json baselines |
| `/health` | `model_is_finetuned`, `model_source` |

## 11. Limitations

1. **Single dataset:** Only IMDB reviews; domain transfer not evaluated.
2. **Binary classification:** Neutral sentiment is not modelled.
3. **Truncation:** Reviews exceeding `max_length` tokens lose information (ablation quantifies impact).
4. **Interpretability:** Input × gradient is a first-order approximation; SHAP or integrated gradients would be more rigorous but computationally expensive for real-time API.
5. **No cross-validation:** Train/val/test split is fixed; k-fold CV would provide variance estimates but is computationally prohibitive for transformer fine-tuning.
6. **Compute constraints:** Ablation study uses a train subset (default 3 000 rows) for practicality.

## 12. References

Primary sources actually used in the protocol. Do not pad the list.

1. Maas, A. L. et al. (2011). *Learning Word Vectors for Sentiment Analysis.* ACL.
2. Devlin, J. et al. (2019). *BERT: Pre-training of Deep Bidirectional Transformers.* NAACL.
3. Sanh, V. et al. (2019). *DistilBERT, a distilled version of BERT.* NeurIPS Workshop.
4. Efron, B. & Tibshirani, R. J. (1993). *An Introduction to the Bootstrap.* Chapman & Hall.
5. McNemar, Q. (1947). Note on the sampling error of the difference between correlated proportions. *Psychometrika*.
6. Pang, B. & Lee, L. (2008). *Opinion Mining and Sentiment Analysis.* Foundations and Trends in IR.
