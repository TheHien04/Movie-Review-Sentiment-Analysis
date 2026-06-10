"""Weights & Biases experiment tracking (parallel to MLflow)."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent

_active_run = None


def wandb_enabled() -> bool:
    return os.getenv("WANDB_ENABLED", "true").lower() in ("1", "true", "yes")


def wandb_start(
    project: str = "cinesentiment",
    run_name: str | None = None,
    config: dict[str, Any] | None = None,
    tags: list[str] | None = None,
):
    global _active_run
    if not wandb_enabled():
        return None
    if os.getenv("WANDB_MODE", "").lower() == "disabled":
        return None
    try:
        import wandb
    except ImportError:
        return None

    if _active_run is not None:
        return _active_run

    _active_run = wandb.init(
        project=os.getenv("WANDB_PROJECT", project),
        name=run_name,
        config=config or {},
        tags=tags or ["cinesentiment"],
        dir=str(PROJECT_ROOT / "artifacts" / "wandb"),
        reinit=True,
    )
    return _active_run


def wandb_log_metrics(metrics: dict[str, float], step: int | None = None) -> None:
    if not wandb_enabled():
        return
    try:
        import wandb
    except ImportError:
        return
    if wandb.run is None:
        return
    clean = {k: float(v) for k, v in metrics.items() if v is not None}
    wandb.log(clean, step=step)


def wandb_log_params(params: dict[str, Any]) -> None:
    if not wandb_enabled():
        return
    try:
        import wandb
    except ImportError:
        return
    if wandb.run is None:
        return
    wandb.config.update({k: v for k, v in params.items()}, allow_val_change=True)


def wandb_log_artifact(path: str | Path, name: str | None = None) -> None:
    if not wandb_enabled():
        return
    try:
        import wandb
    except ImportError:
        return
    if wandb.run is None:
        return
    p = Path(path)
    if p.is_file():
        art = wandb.Artifact(name or p.stem, type="model")
        art.add_file(str(p))
        wandb.log_artifact(art)


def wandb_finish() -> None:
    global _active_run
    if not wandb_enabled():
        return
    try:
        import wandb
    except ImportError:
        return
    if wandb.run is not None:
        wandb.finish()
    _active_run = None
