"""Unified experiment logging — MLflow + Weights & Biases."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from backend.mlflow_utils import log_artifact as mlflow_log_artifact
from backend.mlflow_utils import log_metrics as mlflow_log_metrics
from backend.mlflow_utils import log_params as mlflow_log_params
from backend.mlflow_utils import mlflow_run
from backend.wandb_utils import wandb_finish, wandb_log_artifact, wandb_log_metrics, wandb_log_params, wandb_start


@contextmanager
def experiment_run(
    experiment: str,
    run_name: str | None = None,
    params: dict[str, Any] | None = None,
    tags: list[str] | None = None,
) -> Iterator[Any]:
    if params:
        mlflow_log_params(params)
    wandb_start(project=experiment.replace("cinesentiment-", "cinesentiment"), run_name=run_name, config=params, tags=tags)
    if params:
        wandb_log_params(params)
    with mlflow_run(experiment, run_name=run_name) as run:
        try:
            yield run
        finally:
            wandb_finish()


def log_metrics(metrics: dict[str, float], step: int | None = None) -> None:
    mlflow_log_metrics(metrics, step=step)
    wandb_log_metrics(metrics, step=step)


def log_params(params: dict[str, Any]) -> None:
    mlflow_log_params(params)
    wandb_log_params(params)


def log_artifact(path: str | Path) -> None:
    mlflow_log_artifact(path)
    wandb_log_artifact(path)
