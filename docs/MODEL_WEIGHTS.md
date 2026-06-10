# Model weights

Weights are **not** stored in git (see `.gitignore`) because `model.safetensors` is ~250MB.

## Generate locally (recommended)

```bash
make install
make train          # full 35k train set, ~3 epochs (hours on CPU)
# or quick checkpoint for demos:
make train-fast     # 2k samples, 1 epoch (~15 min on Apple Silicon)
make evaluate
make release-check
```

Outputs:

- `sentiment_model/model.safetensors`
- `artifacts/results/evaluation.json`
- `artifacts/results/confusion_matrix.png`

## GitHub release (optional)

Attach a zip of `sentiment_model/` to release **v1.0.0** so users can unzip without training.

## Docker

Mount trained weights:

```yaml
volumes:
  - ./sentiment_model:/app/sentiment_model
```
