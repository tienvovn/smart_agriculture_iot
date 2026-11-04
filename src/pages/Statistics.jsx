import { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MainLayout from '../layouts/MainLayout';
import { useFarm } from '../context/FarmContext';
import { iotApi } from '../components/api/iotApi';

const SENSORS = [
  { value: 'humidity', label: 'Soil moisture' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'soil_ph', label: 'Soil pH' },
  { value: 'pump_current', label: 'Pump current' }
];
const TIERS = [
  { id: 'hot', name: 'HOT', detail: 'Raw Time Series · 30 days', color: 'border-orange-500/50 text-orange-300' },
  { id: 'warm', name: 'WARM', detail: 'Daily rollups · 400 days', color: 'border-cyan-500/50 text-cyan-300' },
  { id: 'cold', name: 'COLD', detail: 'Monthly rollups · long term', color: 'border-violet-500/50 text-violet-300' }
];

function todayInVietnam() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function unitLabel(unit) {
  return ({ celsius: '°C', percent: '%', ph: 'pH', ampere: 'A' })[unit] || unit;
}

function Summary({ label, value }) {
  return <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 text-2xl font-bold text-white">{value}</p>
  </div>;
}

export default function Statistics() {
  const { farms, error: connectionError } = useFarm();
  const [period, setPeriod] = useState('day');
  const [value, setValue] = useState(todayInVietnam());
  const [farmCode, setFarmCode] = useState('');
  const [sensorType, setSensorType] = useState('humidity');
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const availableFarms = farms.filter((farm) => farm.code);
  const selectedFarmCode = availableFarms.some((farm) => farm.code === farmCode)
    ? farmCode : availableFarms[0]?.code || '';

  useEffect(() => {
    if (!selectedFarmCode || !value) return;
    let active = true;
    iotApi.telemetryTrend({ period, value, farmCode: selectedFarmCode, sensorType }).then((data) => {
      if (active) { setResult(data); setError(''); setLoading(false); }
    }).catch((requestError) => {
      if (active) { setResult(null); setError(requestError.message); setLoading(false); }
    });
    return () => { active = false; };
  }, [period, value, selectedFarmCode, sensorType, refreshKey]);

  const summary = useMemo(() => {
    const points = result?.points || [];
    const samples = points.reduce((sum, point) => sum + point.samples, 0);
    return {
      samples,
      average: samples ? points.reduce((sum, point) => sum + point.average * point.samples, 0) / samples : null,
      minimum: points.length ? Math.min(...points.map((point) => point.minimum)) : null,
      maximum: points.length ? Math.max(...points.map((point) => point.maximum)) : null
    };
  }, [result]);
  const unit = unitLabel(result?.unit || '');

  function changePeriod(next) {
    setPeriod(next);
    setValue(todayInVietnam().slice(0, next === 'day' ? 10 : next === 'month' ? 7 : 4));
    setResult(null);
    setLoading(true);
  }

  return <MainLayout>
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-400">MongoDB telemetry</p>
        <h1 className="mt-2 text-3xl font-black text-white">Telemetry Explorer</h1>
        <p className="mt-2 text-sm text-slate-400">Slice sensor history by Vietnam day, month or year. Each point shows its source tier.</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex rounded-xl border border-slate-600 bg-slate-900 p-1" role="group" aria-label="Time slicer">
            {['day', 'month', 'year'].map((option) => <button
              key={option} type="button" onClick={() => changePeriod(option)} aria-pressed={period === option}
              className={`rounded-lg px-4 py-2 text-sm font-bold capitalize transition ${period === option ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >{option}</button>)}
          </div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {period === 'year' ? 'Year' : period === 'month' ? 'Month' : 'Day'}
            <input
              className="mt-1 block w-44 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white"
              aria-label="Selected date" type={period === 'year' ? 'number' : period === 'day' ? 'date' : 'month'}
              min={period === 'year' ? 1970 : undefined} max={period === 'year' ? 2100 : undefined}
              value={value} onChange={(event) => { setValue(event.target.value); setResult(null); setLoading(true); }}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Farm
            <select className="mt-1 block min-w-40 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" value={selectedFarmCode} onChange={(event) => { setFarmCode(event.target.value); setResult(null); setLoading(true); }}>
              {availableFarms.map((farm) => <option key={farm.code} value={farm.code}>{farm.name}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Sensor
            <select className="mt-1 block min-w-40 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white" value={sensorType} onChange={(event) => { setSensorType(event.target.value); setResult(null); setLoading(true); }}>
              {SENSORS.map((sensor) => <option key={sensor.value} value={sensor.value}>{sensor.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => { setResult(null); setLoading(true); setRefreshKey((key) => key + 1); }} className="rounded-lg border border-slate-500 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700">Refresh</button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {TIERS.map((tier) => <div key={tier.id} className={`rounded-xl border bg-slate-900/60 p-4 ${tier.color} ${result?.tiers.includes(tier.id) ? 'ring-2 ring-current' : 'opacity-60'}`}>
          <div className="text-sm font-black tracking-widest">{tier.name}</div>
          <div className="mt-1 text-xs text-slate-300">{tier.detail}</div>
        </div>)}
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-800/70 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">{SENSORS.find((sensor) => sensor.value === sensorType)?.label} trend</h2>
            <p className="mt-1 text-xs text-slate-400">Timezone: Asia/Ho_Chi_Minh · Resolution: {result?.resolution || '—'}</p>
          </div>
          <span className="rounded-full border border-slate-600 px-3 py-1 text-xs font-bold text-slate-300">{summary.samples.toLocaleString()} readings</span>
        </div>
        {error && <p className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        {!selectedFarmCode && <p className="mt-5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200">Connect the backend and load a farm to explore telemetry. {connectionError}</p>}
        {loading && selectedFarmCode && <p className="mt-6 text-sm text-slate-400">Loading MongoDB telemetry…</p>}
        {!loading && !error && result?.points.length === 0 && <p className="mt-6 rounded-lg border border-slate-700 p-6 text-center text-sm text-slate-400">No readings in this period. For older periods, run the daily and monthly maintenance jobs before TTL expires.</p>}
        {!loading && result?.points.length > 0 && <>
          <div className="mt-6 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.points} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="4 4" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} unit={unit === 'pH' ? '' : unit} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#475569', color: '#fff' }} formatter={(point) => [`${point} ${unit}`, 'Average']} />
                <Line type="monotone" dataKey="average" stroke="#34d399" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Summary label="Weighted average" value={`${summary.average?.toFixed(2)} ${unit}`} />
            <Summary label="Minimum" value={`${summary.minimum} ${unit}`} />
            <Summary label="Maximum" value={`${summary.maximum} ${unit}`} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {result.points.map((point) => <span key={point.at} className="rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-300">{point.label}: {point.tier.toUpperCase()}</span>)}
          </div>
        </>}
      </div>
    </div>
  </MainLayout>;
}
