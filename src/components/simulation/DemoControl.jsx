import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFarm } from '../../context/FarmContext';
import { iotApi } from '../api/iotApi';

const displayBytes = (bytes) => bytes == null ? '--' : `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;

function Step({ number, title, description, active, done }) {
  return (
    <div className={active ? 'rounded-xl border border-amber-400 bg-amber-400/10 p-4' : 'rounded-xl border border-slate-700 bg-slate-900 p-4'}>
      <div className="flex items-center gap-3">
        <span className={done ? 'flex h-8 w-8 items-center justify-center rounded-full bg-green-600 font-bold text-white' : 'flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 font-bold text-white'}>{number}</span>
        <div><p className="font-bold text-white">{title}</p><p className="text-sm text-slate-400">{description}</p></div>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return <div className="rounded-xl bg-slate-800 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 break-words text-xl font-bold text-white">{value}</p></div>;
}

export default function DemoControl() {
  const { farms, connected, error, telemetryPipeline, startAckTimeoutScenario, startSilentFailureScenario, restoreController, retryIncident, resetScenario } = useFarm();
  const [farmCode, setFarmCode] = useState('FARM-002');
  const [busy, setBusy] = useState('');
  const [storage, setStorage] = useState(null);
  useEffect(() => {
    iotApi.telemetryStorage().then(setStorage).catch(() => {});
  }, []);
  const farm = farms.find((item) => item.code === farmCode) || farms.find((item) => item.code) || farms[0];
  const incident = farm?.incident;
  const stage = useMemo(() => {
    if (incident?.status === 'mitigating') return 3;
    if (incident?.status === 'open') return 2;
    if (farm?.scenario === 'pump_ack_timeout' || farm?.scenario === 'pump_no_effect') return 1;
    return 0;
  }, [farm, incident]);

  const act = async (name, action) => {
    setBusy(name);
    try { await action(); } catch { /* FarmContext displays the request error. */ } finally { setBusy(''); }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-slate-800 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-300">FarmGuard live incident</p>
            <h2 className="mt-2 text-2xl font-bold text-white">The green ACK trap</h2>
            <p className="mt-2 max-w-3xl text-slate-300">The controller accepts the command, but the pump draws no current and the soil keeps drying. FarmGuard detects the missing physical outcome, then proves recovery from MongoDB telemetry.</p>
          </div>
          <span className={connected ? 'rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white' : 'rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white'}>Backend {connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
        </div>
        {error && <div className="mt-4 rounded-xl border border-red-500 bg-red-500/10 p-4 text-red-300">{error}</div>}
        <label className="mt-6 block text-sm font-semibold text-slate-300">Demo farm</label>
        <select value={farm?.code || ''} onChange={(event) => setFarmCode(event.target.value)} className="mt-2 w-full rounded-xl bg-slate-700 p-3 text-white">
          {farms.filter((item) => item.code).map((item) => <option key={item.id} value={item.code}>{item.name} ({item.code})</option>)}
        </select>
      </div>

      {farm && <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Soil moisture" value={String(farm.humidity ?? '--') + '%'} />
        <Metric label="Command / ACK" value={String(farm.pumpState?.commandStatus || 'idle') + ' / ' + (farm.pumpState?.acknowledged ? 'yes' : 'no')} />
        <Metric label="Measured pump current" value={String(farm.pumpState?.currentAmp ?? 0) + ' A'} />
        <Metric label="Controller / power" value={(farm.pumpState?.controllerOnline ? 'ONLINE' : 'OFFLINE') + ' / ' + (farm.pumpState?.powerAvailable ? 'ON' : 'OFF')} />
      </div>}

      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-6 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-green-300">MongoDB telemetry pipeline</p>
            <h3 className="mt-1 text-xl font-bold">Live anomaly evidence</h3>
          </div>
          <div className="text-sm text-slate-300">Time Series → event → {telemetryPipeline.mode === 'change-stream' ? 'Change Stream' : 'direct detector'} · MQTT {telemetryPipeline.mqttConnected ? 'connected' : 'off'}</div>
        </div>
        <p className="mt-2 text-sm text-slate-400">An anomaly needs 12 prior readings from the same device. Pump outcome is evaluated separately against ACK, motor current, and soil moisture.</p>
        <div className="mt-4 space-y-2">
          {(telemetryPipeline.anomalies || []).filter((item) => item.farmCode === farm?.code).slice(0, 5).map((item) => (
            <div key={item._id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm">
              <span className="font-semibold">{item.sensorType}: {item.value} (baseline {item.baselineMean.toFixed(2)})</span>
              <span className="text-amber-300">{item.zScore.toFixed(1)}σ · {item.source} · {new Date(item.capturedAt).toLocaleTimeString()}</span>
            </div>
          ))}
          {!telemetryPipeline.anomalies?.some((item) => item.farmCode === farm?.code) && <p className="text-sm text-slate-400">No statistical anomalies recorded for this farm yet.</p>}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-700 pt-4 text-sm text-slate-300">
          <span>Time Series measurements: <strong className="text-white">{storage?.measurements?.toLocaleString() ?? '--'}</strong></span>
          <span>Logical data: <strong className="text-white">{displayBytes(storage?.logicalBytes)}</strong></span>
          <span>Allocated storage: <strong className="text-white">{displayBytes(storage?.allocatedBytes)}</strong></span>
          <span>Buckets: <strong className="text-white">{storage?.bucketCount ?? '--'}</strong></span>
          <button type="button" onClick={() => iotApi.telemetryStorage().then(setStorage).catch(() => {})} className="rounded-lg border border-slate-500 px-3 py-1 text-white hover:bg-slate-700">Refresh storage</button>
        </div>
        <p className="mt-2 text-xs text-slate-500">MongoDB collStats values; allocated storage includes free space and is not a compression ratio.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Step number="1" title="Reveal" description="Inject a fault. The silent failure still sends an ACK." active={stage === 1} done={stage > 1} />
        <Step number="2" title="Diagnose and repair" description="Inspect the evidence, then restore the simulated pump." active={stage === 2} done={stage > 2} />
        <Step number="3" title="Prove the outcome" description="Send the repair command and verify current plus rising moisture." active={stage === 3} done={false} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button disabled={!connected || Boolean(busy) || Boolean(incident)} onClick={() => act('silent', () => startSilentFailureScenario(farm.code))} className="rounded-xl bg-amber-500 px-5 py-4 font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50">{busy === 'silent' ? 'Injecting...' : '1. Inject silent pump failure (recommended)'}</button>
        <button disabled={!connected || Boolean(busy) || Boolean(incident)} onClick={() => act('timeout', () => startAckTimeoutScenario(farm.code))} className="rounded-xl border border-slate-500 bg-slate-700 px-5 py-4 font-bold text-white hover:bg-slate-600 disabled:opacity-50">{busy === 'timeout' ? 'Injecting...' : 'Alternative: inject ACK timeout'}</button>
        <button disabled={!incident || (farm.pumpState?.controllerOnline && farm.pumpState?.powerAvailable) || Boolean(busy)} onClick={() => act('restore', () => restoreController(farm.code))} className="rounded-xl bg-blue-600 px-5 py-4 font-bold text-white hover:bg-blue-500 disabled:opacity-50">{busy === 'restore' ? 'Restoring...' : '2. Restore controller and pump power'}</button>
        <button disabled={!incident || !farm.pumpState?.controllerOnline || !farm.pumpState?.powerAvailable || incident.status !== 'open' || Boolean(busy)} onClick={() => act('retry', () => retryIncident(incident.id))} className="rounded-xl bg-green-600 px-5 py-4 font-bold text-white hover:bg-green-500 disabled:opacity-50">{busy === 'retry' ? 'Sending...' : incident?.type === 'pump_no_effect' ? '3. Issue new command and verify' : '3. Retry and verify physical outcome'}</button>
        <button disabled={!connected || Boolean(busy) || Boolean(incident)} onClick={() => act('reset', () => resetScenario(farm.code))} className="rounded-xl bg-slate-600 px-5 py-4 font-bold text-white hover:bg-slate-500 disabled:opacity-50">Reset simulator fault</button>
        {incident && <Link to="/incidents" className="rounded-xl border border-amber-400/60 bg-amber-400/10 px-5 py-4 text-center font-bold text-amber-200 hover:bg-amber-400/20">Open MongoDB evidence</Link>}
      </div>

      {incident && <div className="rounded-2xl border border-red-500 bg-red-500/10 p-6">
        <p className="font-bold uppercase tracking-wide text-red-300">Active incident: {incident.status}</p>
        <p className="mt-2 text-xl text-white">{incident.summary}</p>
        <p className="mt-2 font-mono text-sm text-slate-400">Correlation: {incident.correlationId}</p>
      </div>}
    </div>
  );
}
