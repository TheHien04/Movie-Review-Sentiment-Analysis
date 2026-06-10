"""MLflow experiment tracking helpers."""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def tracking_uri() -> str:
    return os.getenv("MLFLOW_TRACKING_URI", str(PROJECT_ROOT / "artifacts" / "mlruns"))


def mlflow_enabled() -> bool:
    return os.getenv("MLFLOW_ENABLED", "true").lower() in ("1", "true", "yes")


@contextmanager
def mlflow_run(
    experiment: str,
    run_name: str | None = None,
    tags: dict[str, str] | None = None,
) -> Iterator[Any]:
    """Start an MLflow run or no-op context when disabled / unavailable."""
    if not mlflow_enabled():
        yield None
        return
    try:
        import mlflow
    except ImportError:
        yield None
        return

    mlflow.set_tracking_uri(tracking_uri())
    mlflow.set_experiment(experiment)
    with mlflow.start_run(run_name=run_name, tags=tags or {}) as run:
        mlflow.set_tag("project", "cinesentiment")
        yield run


def log_metrics(metrics: dict[str, float], step: int | None = None) -> None:
    if not mlflow_enabled():
        return
    try:
        import mlflow

        mlflow.log_metrics({k: float(v) for k, v in metrics.items() if v is not None}, step=step)
    except ImportError:
        pass


def log_params(params: dict[str, Any]) -> None:
    if not mlflow_enabled():
        return
    try:
        import mlflow

        mlflow.log_params({k: str(v) for k, v in params.items()})
    except ImportError:
        pass


def log_artifact(path: str | Path) -> None:
    if not mlflow_enabled():
        return
    try:
        import mlflow

        p = Path(path)
        if p.is_file():
            mlflow.log_artifact(str(p))
    except ImportError:
        pass
