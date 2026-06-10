const API_BASE = '';

export type PredictResult = {
  label: number;
  sentiment: string;
  confidence: number;
  probability_positive?: number;
  model_source?: string;
};

export type HealthResult = {
  version: string;
  inference_ready: boolean;
  model_source: string;
};

export async function fetchHealth(): Promise<HealthResult> {
  const r = await fetch(`${API_BASE}/health`);
  if (!r.ok) throw new Error('API unavailable');
  return r.json();
}

export async function predict(text: string): Promise<PredictResult> {
  const r = await fetch(`${API_BASE}/api/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `HTTP ${r.status}`);
  }
  return r.json();
}

export async function fetchStatsReport(): Promise<Record<string, unknown>> {
  const r = await fetch(`${API_BASE}/api/stats-report`);
  if (!r.ok) throw new Error('Stats report unavailable');
  return r.json();
}
