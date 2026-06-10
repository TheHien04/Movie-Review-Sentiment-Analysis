import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchHealth } from '../api/client';

export default function HomePage() {
  const [health, setHealth] = useState<string>('checking…');

  useEffect(() => {
    fetchHealth()
      .then((h) => setHealth(`v${h.version} · ${h.model_source} · ready=${h.inference_ready}`))
      .catch(() => setHealth('API offline — run make serve-prod'));
  }, []);

  return (
    <section className="hero card">
      <p className="eyebrow">React + TypeScript · v2.2 Silicon Valley stack</p>
      <h1>Movie Review Sentiment</h1>
      <p className="lead">
        Modern dashboard for DistilBERT inference, statistics, and developer APIs.
        Classic cinema UI still available at the legacy site.
      </p>
      <p className="status-pill">{health}</p>
      <div className="cta-row">
        <Link className="btn btn-primary" to="/analyze">Analyze a review</Link>
        <Link className="btn btn-secondary" to="/stats">View statistics</Link>
      </div>
      <ul className="feature-list">
        <li>MLflow + Weights &amp; Biases experiment tracking</li>
        <li>Prometheus metrics · FastAPI v2 · RAG · LoRA · LLM baseline</li>
        <li>Kubernetes + Helm deployment manifests</li>
      </ul>
    </section>
  );
}
