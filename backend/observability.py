"""Prometheus metrics + optional OpenTelemetry for Flask."""
from __future__ import annotations

import os
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from flask import Flask

_metrics_initialized = False

try:
    from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

    HTTP_REQUESTS = Counter(
        "cinesentiment_http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"],
    )
    HTTP_LATENCY = Histogram(
        "cinesentiment_http_request_duration_seconds",
        "HTTP request latency",
        ["method", "endpoint"],
        buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    )
    PREDICT_REQUESTS = Counter(
        "cinesentiment_predict_requests_total",
        "Sentiment prediction calls",
        ["route"],
    )
    _PROM_AVAILABLE = True
except ImportError:
    _PROM_AVAILABLE = False


def prometheus_enabled() -> bool:
    return _PROM_AVAILABLE and os.getenv("PROMETHEUS_ENABLED", "true").lower() in ("1", "true", "yes")


def init_flask_observability(app: "Flask") -> None:
    global _metrics_initialized
    if _metrics_initialized:
        return
    _metrics_initialized = True

    if prometheus_enabled():

        @app.before_request
        def _prom_start_timer():
            from flask import g, request

            g._prom_start = time.perf_counter()

        @app.after_request
        def _prom_record(response):
            from flask import g, request

            start = getattr(g, "_prom_start", None)
            endpoint = request.endpoint or "unknown"
            if start is not None:
                HTTP_LATENCY.labels(request.method, endpoint).observe(time.perf_counter() - start)
            HTTP_REQUESTS.labels(request.method, endpoint, str(response.status_code)).inc()
            return response

        @app.route("/metrics")
        def prometheus_metrics():
            from flask import Response

            return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)

    if os.getenv("OTEL_ENABLED", "false").lower() in ("1", "true", "yes"):
        try:
            from opentelemetry import trace
            from opentelemetry.instrumentation.flask import FlaskInstrumentor
            from opentelemetry.sdk.resources import Resource
            from opentelemetry.sdk.trace import TracerProvider
            from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

            resource = Resource.create({"service.name": "cinesentiment-flask"})
            provider = TracerProvider(resource=resource)
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            trace.set_tracer_provider(provider)
            FlaskInstrumentor().instrument_app(app)
        except ImportError:
            pass


def record_predict(route: str = "predict") -> None:
    if prometheus_enabled():
        PREDICT_REQUESTS.labels(route).inc()
