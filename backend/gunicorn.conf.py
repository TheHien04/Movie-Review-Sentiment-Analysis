"""
Gunicorn production config — used by Docker and `make serve-prod`.
"""
import os

bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = int(os.getenv("GUNICORN_WORKERS", "2"))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "sync")
threads = int(os.getenv("GUNICORN_THREADS", "1"))
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = int(os.getenv("GUNICORN_GRACEFUL_TIMEOUT", "30"))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", "5"))
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "1000"))
max_requests_jitter = int(os.getenv("GUNICORN_MAX_REQUESTS_JITTER", "50"))
accesslog = os.getenv("GUNICORN_ACCESS_LOG", "-")
errorlog = os.getenv("GUNICORN_ERROR_LOG", "-")
loglevel = os.getenv("LOG_LEVEL", "info").lower()
capture_output = True
enable_stdio_inheritance = True

# Load Flask app + model once per worker (acceptable for 1–2 workers on demo hardware)
preload_app = os.getenv("GUNICORN_PRELOAD", "true").lower() == "true"
