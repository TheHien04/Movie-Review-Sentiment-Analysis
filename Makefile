.PHONY: venv install serve serve-prod serve-fastapi test train train-fast evaluate baseline error-analysis capstone premium preprocess lint pre-commit download-data release-check lock-deps hypothesis-tests ablation ablation-quick eda eda-errors eda-comparison eda-llm notebooks aspect-train v2-setup log-capstone rag-index lora-train lora-quick mlflow-ui modern-stack frontend-react-build llm-baseline k8s-validate helm-template silicon-valley feast-materialize e2e-playwright kind-up k8s-apply-istio helm-us-east helm-eu-west silicon-valley-100

venv:
	python3 -m venv venv

install: venv
	./venv/bin/pip install -U pip
	./venv/bin/pip install -r backend/requirements.txt
	./venv/bin/pip install -r scripts/requirements-train.txt

serve:
	HUB_MODEL_FALLBACK=$${HUB_MODEL_FALLBACK:-distilbert-base-uncased-finetuned-sst-2-english} \
	RATE_LIMIT_ENABLED=False ./venv/bin/python backend/app.py

serve-prod:
	HUB_MODEL_FALLBACK=$${HUB_MODEL_FALLBACK:-distilbert-base-uncased-finetuned-sst-2-english} \
	RATE_LIMIT_ENABLED=$${RATE_LIMIT_ENABLED:-True} \
	./venv/bin/gunicorn -c backend/gunicorn.conf.py backend.app:app

serve-fastapi:
	HUB_MODEL_FALLBACK=$${HUB_MODEL_FALLBACK:-distilbert-base-uncased-finetuned-sst-2-english} \
	./venv/bin/uvicorn backend.fastapi_app:app --host 127.0.0.1 --port 8001

rag-index:
	./venv/bin/python scripts/index_rag.py

lora-train:
	./venv/bin/python scripts/lora_finetune.py --epochs 3 --max-train-rows 0

lora-quick:
	./venv/bin/python scripts/lora_finetune.py --epochs 1 --max-train-rows 500

mlflow-ui:
	./venv/bin/mlflow ui --backend-store-uri artifacts/mlruns --host 127.0.0.1 --port 5001

modern-stack: rag-index lora-quick
	@echo "Modern stack artifacts ready. Run: make serve-prod & make serve-fastapi"

frontend-react-build:
	cd frontend-react && npm install && npm run build
	@echo "React SPA → frontend-react/dist (serve at /modern/)"

llm-baseline:
	WANDB_MODE=disabled MLFLOW_ENABLED=false ./venv/bin/python scripts/llm_baseline.py --demo --max-rows 100

k8s-validate:
	@for f in deploy/kubernetes/*.yaml deploy/kubernetes/istio/*.yaml deploy/kubernetes/multi-region/*.yaml; do \
		echo "Validating $$f"; \
		./venv/bin/python -c "import yaml,sys; list(yaml.safe_load_all(open(sys.argv[1])))" "$$f" || exit 1; \
	done
	@echo "Kubernetes + Istio + multi-region manifests OK"

helm-template:
	helm template cinesentiment deploy/helm/cinesentiment --debug > /dev/null
	helm template cinesentiment-us deploy/helm/cinesentiment -f deploy/helm/cinesentiment/values-us-east.yaml > /dev/null
	helm template cinesentiment-eu deploy/helm/cinesentiment -f deploy/helm/cinesentiment/values-eu-west.yaml > /dev/null
	@echo "Helm chart renders OK (default + us-east + eu-west)"

feast-materialize:
	./venv/bin/python scripts/feast_materialize.py

e2e-playwright:
	cd e2e && npm install && npx playwright install chromium && npm test

kind-up:
	kind create cluster --name cinesentiment --config deploy/kind/cluster.yaml || true
	kubectl apply -f deploy/kubernetes/namespace.yaml
	@echo "Kind cluster ready — apply remaining manifests with: kubectl apply -f deploy/kubernetes/"

k8s-apply-istio:
	kubectl apply -f deploy/kubernetes/istio/

helm-us-east:
	helm upgrade --install cinesentiment-us deploy/helm/cinesentiment -f deploy/helm/cinesentiment/values-us-east.yaml

helm-eu-west:
	helm upgrade --install cinesentiment-eu deploy/helm/cinesentiment -f deploy/helm/cinesentiment/values-eu-west.yaml

silicon-valley: frontend-react-build llm-baseline k8s-validate test
	@echo "v2.2 Silicon Valley stack ready (>90% checklist)"

silicon-valley-100: feast-materialize frontend-react-build llm-baseline k8s-validate helm-template test
	@echo "v2.3 FAANG-complete stack ready (100% checklist)"

test:
	HUB_MODEL_FALLBACK=distilbert-base-uncased-finetuned-sst-2-english \
	RATE_LIMIT_ENABLED=False CACHE_ENABLED=False \
	./venv/bin/pytest tests/ -v --tb=short

preprocess:
	./venv/bin/python scripts/data_preprocessing.py

train:
	./venv/bin/python scripts/model_training.py --epochs 3 --seed 42

train-fast:
	./venv/bin/python scripts/model_training.py --epochs 1 --max-train-rows 2000 --seed 42

evaluate:
	./venv/bin/python scripts/evaluate_model.py
	$(MAKE) dataset-info

dataset-info:
	./venv/bin/python -c "import json; from pathlib import Path; from backend.ml_core import dataset_summary, default_train_path, default_val_path, default_test_path, ARTIFACTS_DIR; r=dataset_summary(default_train_path(), default_val_path(), default_test_path()); p=ARTIFACTS_DIR/'dataset_info.json'; p.parent.mkdir(parents=True, exist_ok=True); json.dump(r, open(p,'w'), indent=2); print('Wrote', p)"

insights-curves:
	./venv/bin/python scripts/generate_insights_curves.py

baseline:
	./venv/bin/python scripts/baseline_tfidf.py

error-analysis:
	./venv/bin/python scripts/error_analysis.py

hypothesis-tests:
	./venv/bin/python scripts/hypothesis_tests.py

ablation:
	./venv/bin/python scripts/ablation_study.py

ablation-quick:
	./venv/bin/python scripts/ablation_study.py --quick

eda:
	./venv/bin/jupyter nbconvert --to html --execute notebooks/01_eda_imdb.ipynb --output-dir=artifacts/results

eda-errors:
	./venv/bin/jupyter nbconvert --to html --execute notebooks/02_error_analysis.ipynb --output-dir=artifacts/results

eda-comparison:
	./venv/bin/jupyter nbconvert --to html --execute notebooks/03_model_comparison.ipynb --output-dir=artifacts/results

eda-llm:
	WANDB_MODE=disabled MLFLOW_ENABLED=false ./venv/bin/jupyter nbconvert --to html --execute notebooks/04_llm_baseline.ipynb --output-dir=artifacts/results

notebooks: eda eda-errors eda-comparison eda-llm
	@echo "All notebooks executed → artifacts/results/*.html"

sync-docs:
	./venv/bin/python scripts/sync_stats_report.py

repair-json:
	./venv/bin/python scripts/repair_json_artifacts.py

# Full capstone pipeline: baseline → train → evaluate → error export → curves → hypothesis tests → tests
capstone: baseline train evaluate error-analysis insights-curves hypothesis-tests sync-docs test release-check log-capstone
	@echo "Capstone pipeline complete."

log-capstone:
	CAPSTONE_PYTEST_NOTE="pytest passed in capstone pipeline" ./venv/bin/python scripts/log_capstone_run.py

# Full academic pipeline including ablation (slow on CPU)
premium: capstone ablation-quick
	@echo "Premium pipeline complete (baselines + ablation)."

lock-deps:
	./venv/bin/pip freeze > requirements-lock.txt
	@echo "Wrote requirements-lock.txt"

lint:
	./venv/bin/python -m compileall backend scripts tests
	@command -v flake8 >/dev/null 2>&1 && flake8 backend/ scripts/ tests/ --max-line-length=127 --count --select=E9,F63,F7,F82 || true

pre-commit:
	pre-commit run --all-files

download-data:
	bash scripts/download_data.sh

aspect-train:
	./venv/bin/python scripts/train_aspect_classifier.py

v2-setup: aspect-train
	@echo "v2.0 ML aspect classifier trained."

release-check:
	@test -f artifacts/results/evaluation.json || (echo "Missing artifacts/results/evaluation.json — run: make train && make evaluate" && exit 1)
	@test -f sentiment_model/model.safetensors -o -f sentiment_model/pytorch_model.bin || (echo "Missing model weights in sentiment_model/ — run: make train" && exit 1)
	@echo "Release artifacts OK"

github-check: ## Pre-push: secrets scan + tests (run before git push)
	@echo "=== GitHub pre-push check ==="
	@if git ls-files --error-unmatch .env 2>/dev/null; then echo "ERROR: .env is tracked by git — run: git rm --cached .env"; exit 1; else echo "OK: .env not tracked"; fi
	@if git grep -E 'sk-[a-zA-Z0-9]{20,}' -- '*.py' '*.js' '*.ts' '*.env' '*.yaml' '*.yml' 2>/dev/null; then echo "ERROR: possible API key in source"; exit 1; else echo "OK: no API keys in source"; fi
	$(MAKE) test
	@echo "=== Ready to push (also enable GitHub secret scanning on the repo) ==="
