# Notebooks — CineSentiment Capstone

| # | Notebook | Purpose | Prerequisite |
|---|----------|---------|--------------|
| 01 | `01_eda_imdb.ipynb` | Exploratory data analysis (balance, length, vocabulary) | `data/raw/*.csv` |
| 02 | `02_error_analysis.ipynb` | FP/FN qualitative + charts for defense | `make error-analysis` |
| 03 | `03_model_comparison.ipynb` | DistilBERT vs baselines + hypothesis tests | `make capstone` or evaluate+baseline |
| 04 | `04_llm_baseline.ipynb` | LLM zero-shot vs DistilBERT (demo or OpenAI) | `make llm-baseline` |

## Run all (export HTML to `artifacts/results/`)

```bash
make notebooks
```

Individual:

```bash
make eda              # 01 only
make eda-errors       # 02 only
make eda-comparison   # 03 only
make eda-llm          # 04 only
```

Open in Jupyter: `jupyter notebook notebooks/`

## For báo cáo

- Insert figures from `artifacts/results/*.png`
- Cite notebook paths in methodology section
- Use `error_defense_samples.csv` and `model_comparison_table.csv` for tables
