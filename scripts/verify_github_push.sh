#!/usr/bin/env bash
# Pre-push hygiene: block secrets, weights, and files professionals keep out of git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ERR=0
fail() { echo "ERROR: $1"; ERR=1; }
ok() { echo "OK: $1"; }

echo "=== GitHub push hygiene ==="

# --- Explicit forbidden paths ---
for path in \
  .env \
  .env.local \
  data/api_keys_registry.json \
  credentials.json \
  secrets.json \
  bandit-report.json; do
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    fail "$path is tracked — run: git rm --cached $path"
  fi
done
ok "no forbidden secret files tracked"

# --- Full IMDB splits (download via make preprocess) ---
if git ls-files 'data/raw/' | grep -q '\.csv$'; then
  git ls-files 'data/raw/'
  fail "data/raw/*.csv must not be committed (~65MB). Keep locally; clones run: make preprocess"
else
  ok "data/raw/ CSVs not tracked"
fi

# --- Model weights & private keys ---
if bad=$(git ls-files | grep -E '\.(safetensors|pth|bin|pem|key)$' || true); then
  if [[ -n "$bad" ]]; then
    echo "$bad"
    fail "weights or private keys must not be in git"
  fi
fi
ok "no weight or key files tracked"

# --- Virtualenv / caches ---
if git ls-files | grep -qE '(^|/)(venv|\.venv|node_modules|__pycache__|\.pytest_cache)/'; then
  git ls-files | grep -E '(^|/)(venv|\.venv|node_modules|__pycache__|\.pytest_cache)/' || true
  fail "virtualenv or cache directories tracked"
fi
ok "no venv/node_modules/cache tracked"

# --- Large blobs (>5MB) except README screenshots ---
while IFS= read -r f; do
  [[ -f "$f" ]] || continue
  size=$(wc -c < "$f" | tr -d ' ')
  if [[ "$size" -gt 5242880 ]]; then
    case "$f" in
      Images/*) continue ;;
      *)
        echo "  $size bytes  $f"
        fail "file exceeds 5MB — use Git LFS, release assets, or local-only data"
        ;;
    esac
  fi
done < <(git ls-files)

if [[ "$ERR" -eq 0 ]]; then
  ok "no oversized tracked files (except Images/)"
fi

# --- Secret patterns in source (tracked files only) ---
PATTERNS=(
  'sk-[a-zA-Z0-9]{20,}'
  'ghp_[a-zA-Z0-9]{20,}'
  'AKIA[0-9A-Z]{16}'
)
for pat in "${PATTERNS[@]}"; do
  if git grep -E "$pat" -- '*.py' '*.js' '*.ts' '*.tsx' '*.yaml' '*.yml' '*.json' '*.sh' 2>/dev/null \
    | grep -v '\.env\.example' | grep -v 'secret\.example' | grep -v 'sk_test_\.\.\.' | grep -v 'sk-\.\.\.' ; then
    fail "possible secret token in tracked source (pattern: $pat)"
  fi
done
ok "no obvious API tokens in source"

if [[ "$ERR" -ne 0 ]]; then
  echo ""
  echo "Fix the issues above before: git push"
  exit 1
fi

echo "=== Hygiene checks passed ==="
