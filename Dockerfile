# Multi-stage Dockerfile for Movie Sentiment Analysis
# Stage 0: React modern UI (optional /modern/)
FROM node:20-slim as frontend-react

WORKDIR /app
COPY frontend-react/package.json ./
RUN npm install
COPY frontend-react/ ./
RUN npm run build

# Stage 1: Build Python dependencies
FROM python:3.11-slim as builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

RUN pip install --user --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

COPY --from=builder /root/.local /home/appuser/.local
ENV PATH=/home/appuser/.local/bin:$PATH

COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY --from=frontend-react /app/dist ./frontend-react/dist
COPY data/samples/ ./data/samples/
COPY sentiment_model/ ./sentiment_model/

RUN mkdir -p logs && chown -R appuser:appuser /app

ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=backend/app.py
ENV FLASK_ENV=production
ENV DEBUG=False
ENV HOST=0.0.0.0
ENV PORT=8000
ENV GUNICORN_WORKERS=2
ENV HUB_MODEL_FALLBACK=distilbert-base-uncased-finetuned-sst-2-english
ENV RATE_LIMIT_ENABLED=True

USER appuser

HEALTHCHECK --interval=30s --timeout=15s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8000/health/ready || exit 1

EXPOSE 8000

CMD gunicorn -c backend/gunicorn.conf.py backend.app:app
