#!/usr/bin/env bash
# Wait for training to finish, then evaluate + test + serve.
set -euo pipefail
cd "$(dirname "$0")/.."
source venv/bin/activate
mkdir -p logs

echo "[post-train] Waiting for model_training.py to exit..."
while pgrep -f "scripts/model_training.py" >/dev/null 2>&1; do
  sleep 30
done

echo "[post-train] Training finished. Running evaluate..."
make evaluate 2>&1 | tee logs/evaluate.log

echo "[post-train] Running baseline (merge if missing)..."
make baseline 2>&1 | tee -a logs/baseline.log

echo "[post-train] Error analysis..."
make error-analysis 2>&1 | tee logs/error_analysis.log

echo "[post-train] Tests..."
make test 2>&1 | tee logs/pytest.log

make release-check

echo "[post-train] Starting server on http://127.0.0.1:8000"
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
nohup ./venv/bin/python backend/app.py >> logs/serve.log 2>&1 &
echo "[post-train] Done. Open http://127.0.0.1:8000/evaluation.html"
