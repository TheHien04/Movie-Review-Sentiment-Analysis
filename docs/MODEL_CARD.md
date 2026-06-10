# Model Card — Movie Sentiment AI

## Model summary

| Field | Value |
|-------|--------|
| **Name** | DistilBERT IMDB sentiment classifier |
| **Base** | `distilbert-base-uncased` |
| **Task** | Binary text classification |
| **Labels** | `0` negative, `1` positive |
| **Framework** | PyTorch + Hugging Face Transformers |

## Intended use

- Educational / research: sentiment analysis on **movie reviews** (English).
- Demo dashboard for statistical ML coursework (metrics, confusion matrix, threshold analysis).

## Out-of-scope

- Non-English text, sarcasm-heavy social media, non-review genres without fine-tuning.
- High-stakes decisions (hiring, legal, medical) — not validated for those domains.

## Training data

- **Source**: IMDB via `datasets.load_dataset("imdb")`
- **Splits**: see [data/README.md](../data/README.md)
- **Preprocessing**: HTML tag removal; stratified split (seed 42)

## Evaluation

- **Primary metric**: F1 on held-out **test** set (reported in `artifacts/results/evaluation.json` after `make train`).
- **Validation**: used for early stopping and live dashboard metrics (`/api/metrics?split=val`).
- **Statistics**: bootstrap 95% CIs (500 resamples) — see [METHODOLOGY.md](METHODOLOGY.md).

## Baseline comparison

| Model | Test accuracy (typical) | Notes |
|-------|----------------------|--------|
| TF-IDF + Logistic Regression | ~91% | `make baseline` |
| DistilBERT (fine-tuned) | See `evaluation.json` | `make train` |

Run `GET /api/model-comparison?split=test` for side-by-side metrics.

## Limitations

1. **Explainability UI** uses a lexicon heuristic, not model attention or SHAP.
2. **Class balance** in IMDB is roughly balanced; metrics on imbalanced production data may differ.
3. **Inference** requires trained weights in `sentiment_model/` (`pytorch_model.bin` or `model.safetensors`).

## How to reproduce

```bash
make install
make train        # or make train-fast for a smoke checkpoint
make evaluate
make test
```

## Versioning

- Training script: `scripts/model_training.py`
- Evaluation artifact: `artifacts/results/evaluation.json`
- Release process: [RELEASE.md](RELEASE.md)
