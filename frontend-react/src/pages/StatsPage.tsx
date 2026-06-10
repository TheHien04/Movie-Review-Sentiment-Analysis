import { useEffect, useState } from 'react';
import { fetchStatsReport } from '../api/client';

export default function StatsPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStatsReport()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed'));
  }, []);

  const test = (data?.primary_results as { test?: Record<string, number> })?.test;

  return (
    <section className="card">
      <h2>Statistics snapshot</h2>
      <p className="muted">Live from <code>/api/stats-report</code> — full report in classic UI.</p>
      {error && <p className="error">{error}</p>}
      {test && (
        <table className="stats-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(test).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <a className="btn btn-secondary" href="/summary.html">
        Open full Statistics page
      </a>
    </section>
  );
}
