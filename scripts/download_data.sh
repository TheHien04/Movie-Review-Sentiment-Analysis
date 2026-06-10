#!/usr/bin/env bash
# Ensure data/raw splits exist; regenerate from IMDB if missing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/data/raw"

if [[ -f "$RAW/train.csv" && -f "$RAW/val.csv" && -f "$RAW/test.csv" ]]; then
  echo "Data already present in data/raw/"
  wc -l "$RAW"/*.csv
  exit 0
fi

echo "Generating IMDB splits into data/raw/ ..."
cd "$ROOT"
if [[ -d venv ]]; then
  # shellcheck disable=SC1091
  source venv/bin/activate
fi
python scripts/data_preprocessing.py
