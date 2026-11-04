const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || `Request failed with status ${response.status}`);
  return payload.data;
}

export const iotApi = {
  snapshot: () => request('/iot/snapshot'),
  telemetryStorage: () => request('/iot/telemetry/storage'),
  telemetryTrend: ({ period, value, farmCode, sensorType }) => request(
    `/iot/telemetry/trend?${new URLSearchParams({ period, value, farmCode, sensorType })}`
  ),
  startAckTimeout: (farmCode) =>
    request('/iot/simulation/ack-timeout', { method: 'POST', body: JSON.stringify({ farmCode }) }),
  startSilentFailure: (farmCode) =>
    request('/iot/simulation/silent-failure', { method: 'POST', body: JSON.stringify({ farmCode }) }),
  incidentEvidence: (incidentId) =>
    request(`/iot/incidents/${encodeURIComponent(incidentId)}/evidence`),
  restoreController: (farmCode) =>
    request('/iot/simulation/restore-controller', { method: 'POST', body: JSON.stringify({ farmCode }) }),
  retryIncident: (incidentId) =>
    request(`/iot/incidents/${encodeURIComponent(incidentId)}/retry`, { method: 'POST' }),
  resetScenario: (farmCode) =>
    request('/iot/simulation/reset', { method: 'POST', body: JSON.stringify({ farmCode }) }),
  streamUrl: `${API_BASE}/iot/stream`
};
