import { Link } from 'react-router-dom';
import { useFarm } from '../../context/FarmContext';

export default function ProductHero() {
  const { assurance, connected } = useFarm();
  return (
    <section className="overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
      <div className="flex flex-col justify-between gap-8 xl:flex-row xl:items-center">
        <div className="max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Irrigation Assurance</span>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${connected ? 'bg-green-500/15 text-green-300' : 'bg-red-500/15 text-red-300'}`}>{connected ? 'LIVE' : 'BACKEND OFFLINE'}</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">FarmGuard</h1>
          <p className="mt-4 text-xl leading-relaxed text-slate-300">Know that water actually reached the crop—not just that a pump command was sent.</p>
          <p className="mt-3 max-w-2xl text-slate-400">FarmGuard verifies every irrigation using device acknowledgement, physical pump current and soil-moisture recovery.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/incidents" className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-500">Open Incident Center</Link>
            <Link to="/simulation" className="rounded-xl border border-slate-600 px-5 py-3 font-bold text-slate-200 hover:bg-slate-800">Run failure demo</Link>
          </div>
        </div>
        <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[420px]">
          <Metric label="Protected farms" value={assurance.protectedFarms ?? 0} />
          <Metric label="Confirmed irrigations" value={assurance.confirmedIrrigations ?? 0} />
          <Metric label="Open incidents" value={assurance.openIncidents ?? 0} alert={assurance.openIncidents > 0} />
          <Metric label="Assurance rate" value={`${assurance.assuranceRate ?? 100}%`} />
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, alert = false }) {
  return <div className={`rounded-2xl border p-4 ${alert ? 'border-red-500/50 bg-red-500/10' : 'border-slate-700 bg-slate-900/70'}`}><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className={`mt-2 text-3xl font-black ${alert ? 'text-red-300' : 'text-white'}`}>{value}</p></div>;
}
