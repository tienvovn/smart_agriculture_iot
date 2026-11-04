import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { useFarm } from '../context/FarmContext';
import { iotApi } from '../components/api/iotApi';

function EvidenceTile({ label, value, tone = 'slate' }) {
  const color = tone === 'good' ? 'border-emerald-500/40 bg-emerald-500/10' : tone === 'bad' ? 'border-red-500/40 bg-red-500/10' : 'border-slate-700 bg-slate-900';
  return <div className={'rounded-xl border p-3 ' + color}><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-lg font-bold text-white">{value}</p></div>;
}

function Trend({ readings, field, label, color, unit }) {
  const values = readings.map((reading) => reading[field]).filter((value) => Number.isFinite(value));
  if (values.length < 2) return <p className="text-sm text-slate-500">Waiting for {label.toLowerCase()} samples...</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 0.1);
  const points = values.map((value, index) => {
    const x = 10 + index * 300 / Math.max(values.length - 1, 1);
    const y = 62 - (value - min) / span * 50;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  return <div>
    <div className="mb-1 flex justify-between text-xs text-slate-400"><span>{label}</span><span>{values[values.length - 1]} {unit}</span></div>
    <svg viewBox="0 0 320 72" className="h-24 w-full rounded-lg bg-slate-950" role="img" aria-label={label + ' over the incident'}>
      <path d="M 10 62 H 310" stroke="#334155" strokeWidth="1" />
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  </div>;
}

function IncidentCard({ incident, farmName }) {
  const [evidence, setEvidence] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const result = await iotApi.incidentEvidence(incident.id);
        if (mounted) { setEvidence(result); setError(''); }
      } catch (requestError) {
        if (mounted) setError(requestError.message);
      }
    };
    load();
    const timer = incident.status === 'resolved' ? null : setInterval(load, 2500);
    return () => { mounted = false; if (timer) clearInterval(timer); };
  }, [incident.id, incident.status]);

  const resolved = incident.status === 'resolved';
  const proof = evidence?.recoveryEvidence;
  const acknowledged = Boolean(evidence?.command?.acknowledgedAt);
  const silent = incident.type === 'pump_no_effect';
  const title = resolved ? 'Physical outcome verified' : silent && acknowledged ? 'ACK received. Irrigation failed.' : 'Pump command needs attention';

  return <article className={resolved ? 'rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-6' : 'rounded-2xl border border-red-500/40 bg-red-500/5 p-6'}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className={resolved ? 'text-xs font-bold uppercase tracking-widest text-emerald-300' : 'text-xs font-bold uppercase tracking-widest text-red-300'}>{incident.status} / {incident.type}</p>
        <h3 className="mt-2 text-2xl font-bold text-white">{title}</h3>
        <p className="mt-1 text-slate-300">{farmName}: {incident.summary}</p>
      </div>
      {!resolved && <Link to="/simulation" className="rounded-xl bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-500">Respond</Link>}
    </div>
    <p className="mt-4 break-all font-mono text-xs text-slate-400">Correlation: {incident.correlationId}</p>
    {error && <p className="mt-4 text-sm text-red-300">Evidence unavailable: {error}</p>}
    {!evidence && !error && <p className="mt-4 text-sm text-slate-400">Loading MongoDB evidence...</p>}
    {evidence && <>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-emerald-500/40 px-3 py-1 text-xs font-bold text-emerald-300">MongoDB aggregation</span>
        <span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-300">{evidence.timeline.length} paired telemetry samples</span>
        {resolved && <span className={evidence.recovered ? 'rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white' : 'rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white'}>{evidence.recovered ? 'RECOVERY PROVEN' : 'EVIDENCE INCOMPLETE'}</span>}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <EvidenceTile label="Controller ACK" value={acknowledged ? 'Received' : 'Missing'} tone={acknowledged ? 'good' : 'bad'} />
        <EvidenceTile label="Measured current" value={String(proof?.pumpCurrentAmp ?? 0) + ' A'} tone={(proof?.pumpCurrentAmp ?? 0) > 0 ? 'good' : 'bad'} />
        <EvidenceTile label="Moisture at response" value={proof?.moistureBefore == null ? '--' : String(proof.moistureBefore) + '%'} />
        <EvidenceTile label="Latest moisture" value={proof?.moistureAfter == null ? '--' : String(proof.moistureAfter) + '%'} tone={proof?.recovered ? 'good' : 'bad'} />
      </div>
      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4">
        <h4 className="text-sm font-bold uppercase tracking-wide text-slate-300">Command lineage / same correlation ID</h4>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {evidence.commands.map((item, index) => <div key={item.commandId} className="rounded-lg bg-slate-950 p-3 text-sm text-slate-300">
            <p className="font-bold text-white">{index === 0 ? 'Original command' : 'Repair command'}: {item.status}</p>
            <p>ACK: {item.acknowledgedAt ? 'received' : 'missing'} / Physical effect: {item.effectConfirmedAt ? 'confirmed' : 'missing'}</p>
            <p className="mt-1 break-all font-mono text-xs text-slate-500">{item.commandId}</p>
          </div>)}
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Trend readings={evidence.timeline} field="moisture" label="Soil moisture" color="#34d399" unit="%" />
        <Trend readings={evidence.timeline} field="pumpCurrent" label="Pump current" color="#fbbf24" unit="A" />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {evidence.phases.map((phase) => <div key={phase.phase} className="rounded-lg bg-slate-900 p-3 text-sm text-slate-300"><span className="font-bold uppercase text-white">{phase.phase}</span><span className="ml-2">{phase.samples} readings</span><p className="mt-1">Moisture trend: {phase.slope > 0 ? '+' : ''}{phase.slope}%</p></div>)}
      </div>
    </>}
  </article>;
}

export default function Incidents() {
  const { incidents, farms } = useFarm();
  const active = incidents.filter((incident) => incident.status !== 'resolved');
  const resolved = incidents.filter((incident) => incident.status === 'resolved');
  const farmName = (farmId) => farms.find((farm) => farm.id === farmId)?.name || 'Unknown farm';
  return <MainLayout>
    <header className="mb-8">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-400">Operations evidence</p>
      <h1 className="mt-2 text-4xl font-black text-white">Incident Center</h1>
      <p className="mt-3 max-w-3xl text-slate-400">A command is only successful when the telemetry proves water reached the soil.</p>
    </header>
    <section>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold text-white">Needs attention</h2><span className="rounded-full bg-red-500/15 px-3 py-1 text-sm font-bold text-red-300">{active.length} active</span></div>
      {active.length === 0 ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-200">No active incidents. Run the silent failure demo to reveal a false green ACK.</div> : <div className="grid gap-4">{active.map((incident) => <IncidentCard key={incident.id} incident={incident} farmName={farmName(incident.farmId)} />)}</div>}
    </section>
    <section className="mt-10">
      <h2 className="mb-4 text-2xl font-bold text-white">Recovery proof</h2>
      <div className="grid gap-4">{resolved.map((incident) => <IncidentCard key={incident.id} incident={incident} farmName={farmName(incident.farmId)} />)}{resolved.length === 0 && <p className="text-slate-500">No resolved incidents yet.</p>}</div>
    </section>
  </MainLayout>;
}
