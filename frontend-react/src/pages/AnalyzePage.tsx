import { FormEvent, useState } from 'react';
import { predict, PredictResult } from '../api/client';

export default function AnalyzePage() {
  const [text, setText] = useState(
    'The acting is superb but the plot loses steam in the second act.'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResult | null>(null);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await predict(text);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const fresh = result?.label === 1;

  return (
    <section className="card">
      <h2>Analyze review</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="review">Review text</label>
        <textarea
          id="review"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your movie review…"
        />
        <button type="submit" className="btn btn-primary" disabled={loading || !text.trim()}>
          {loading ? 'Analyzing…' : 'Rate this review'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {result && (
        <div className={`result-panel ${fresh ? 'fresh' : 'rotten'}`}>
          <h3>{fresh ? 'Fresh' : 'Rotten'}</h3>
          <p>Confidence: {(result.confidence * 100).toFixed(1)}%</p>
          <p>P(positive): {((result.probability_positive ?? result.confidence) * 100).toFixed(1)}%</p>
          <p className="muted">Model: {result.model_source || '—'}</p>
        </div>
      )}
    </section>
  );
}
