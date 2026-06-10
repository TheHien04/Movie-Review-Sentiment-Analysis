# Dataset

## Layout

| File | Rows (approx.) | Purpose |
|------|----------------|---------|
| `raw/train.csv` | 35,000 | Model training |
| `raw/val.csv` | 7,500 | Threshold tuning / API metrics (live) |
| `raw/test.csv` | 7,500 | **Final** reporting only (`make evaluate`) |
| `samples/*.csv` | 5 | CI / smoke tests only |

Columns: `text` (review), `label` (0 = negative, 1 = positive).

## Regenerate from IMDB

Full splits are **not committed to GitHub** (size + licensing hygiene). After clone:

```bash
make install
make preprocess   # downloads IMDB via Hugging Face `datasets`, writes data/raw/
```

CI uses only `samples/*.csv` (5 rows). Local training and evaluation require `make preprocess` once.

## Reproducibility

- Stratified 70% / 15% / 15% per class  
- Seed: `42` (`scripts/data_preprocessing.py`)  
- HTML tags stripped from review text  

See [docs/METHODOLOGY.md](../docs/METHODOLOGY.md) for evaluation protocol.
