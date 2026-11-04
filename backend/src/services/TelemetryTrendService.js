import { Farm, Telemetry } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { TELEMETRY_TIMEZONE, vietnamDayWindow, vietnamMonthWindow } from './TelemetryRetentionService.js';

const SENSOR_UNITS = {
  temperature: 'celsius',
  humidity: 'percent',
  soil_ph: 'ph',
  pump_current: 'ampere'
};
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function localKey(date, length) {
  return new Date(date.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, length);
}

function periodWindow(period, value) {
  try {
    if (period === 'day') return vietnamDayWindow(value);
    if (period === 'month') return vietnamMonthWindow(value);
    if (period === 'year' && /^\d{4}$/.test(value) && Number(value) >= 1970 && Number(value) <= 2100) {
      return {
        from: new Date(`${value}-01-01T00:00:00+07:00`),
        to: new Date(`${Number(value) + 1}-01-01T00:00:00+07:00`)
      };
    }
  } catch {
    // The public API reports all malformed dates as a client error.
  }
  throw new AppError('Invalid period or date value', 400);
}

function summarize(rows, tier, grain) {
  const periods = new Map();
  for (const row of rows) {
    const at = row._id?.day || row._id?.month || row._id;
    const key = localKey(at, grain === 'month' ? 7 : grain === 'hour' ? 13 : 10);
    const previous = periods.get(key) || {
      at, key, sum: 0, samples: 0, minimum: Infinity, maximum: -Infinity, tier
    };
    previous.sum += row.sum ?? row.average * row.samples;
    previous.samples += row.samples;
    previous.minimum = Math.min(previous.minimum, row.minimum);
    previous.maximum = Math.max(previous.maximum, row.maximum);
    periods.set(key, previous);
  }
  return periods;
}

function addMissing(target, source, excluded = new Set()) {
  for (const [key, point] of source) {
    if (!target.has(key) && !excluded.has(key)) target.set(key, point);
  }
}

function formatPoints(points, grain) {
  return [...points.values()].sort((left, right) => left.at - right.at).map((point) => ({
    at: point.at,
    label: grain === 'hour' ? `${point.key.slice(11, 13)}:00`
      : grain === 'day' ? `${point.key.slice(8, 10)}/${point.key.slice(5, 7)}`
        : point.key,
    average: Math.round(point.sum / point.samples * 100) / 100,
    minimum: point.minimum,
    maximum: point.maximum,
    samples: point.samples,
    tier: point.tier
  }));
}

async function rawPoints(farmId, sensorType, from, to, unit) {
  if (from >= to) return [];
  return Telemetry.aggregate([
    { $match: {
      'meta.farmId': farmId,
      'meta.sensorType': sensorType,
      capturedAt: { $gte: from, $lt: to }
    } },
    { $group: {
      _id: { $dateTrunc: { date: '$capturedAt', unit, timezone: TELEMETRY_TIMEZONE } },
      sum: { $sum: '$value' },
      samples: { $sum: 1 },
      minimum: { $min: '$value' },
      maximum: { $max: '$value' }
    } },
    { $sort: { _id: 1 } }
  ]);
}

export async function getTelemetryTrend({ period, value, farmCode, sensorType, now = new Date() }) {
  const { from, to } = periodWindow(period, value);
  if (!Object.hasOwn(SENSOR_UNITS, sensorType)) throw new AppError('Invalid sensorType', 400);
  if (typeof farmCode !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(farmCode)) {
    throw new AppError('Invalid farmCode', 400);
  }
  const farm = await Farm.findOne({ code: farmCode.toUpperCase() }).select('_id code name').lean();
  if (!farm) throw new AppError('Farm not found', 404);
  const database = Telemetry.db;
  const baseFilter = { farmCode: farm.code, '_id.sensorType': sensorType };
  const hotCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const hotFrom = new Date(Math.max(
    from.getTime(),
    vietnamDayWindow(localKey(hotCutoff, 10)).to.getTime()
  ));
  const rawTo = new Date(Math.min(to.getTime(), now.getTime() + 1000));

  let points;
  let resolution;
  if (period === 'day') {
    const hot = from >= hotCutoff ? await rawPoints(farm._id, sensorType, from, rawTo, 'hour') : [];
    points = summarize(hot, 'hot', 'hour');
    resolution = 'hour';
    if (points.size === 0) {
      const warm = await database.collection('telemetry_daily').find({
        ...baseFilter, '_id.day': { $gte: from, $lt: to }
      }).toArray();
      points = summarize(warm, 'warm', 'day');
      resolution = 'day';
    }
  } else if (period === 'month') {
    const warmCutoff = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
    const preferCold = from < warmCutoff;
    const [warm, raw] = await Promise.all([
      preferCold ? Promise.resolve([]) : database.collection('telemetry_daily').find({
        ...baseFilter, '_id.day': { $gte: from, $lt: to }
      }).toArray(),
      preferCold ? Promise.resolve([]) : rawPoints(farm._id, sensorType, hotFrom, rawTo, 'day')
    ]);
    points = summarize(warm, 'warm', 'day');
    addMissing(points, summarize(raw, 'hot', 'day'));
    resolution = 'day';
    if (points.size === 0) {
      const cold = await database.collection('telemetry_monthly').find({
        ...baseFilter, '_id.month': { $gte: from, $lt: to }
      }).toArray();
      points = summarize(cold.filter((item) => item.complete === true), 'cold', 'month');
      resolution = 'month';
    }
  } else {
    const [cold, warm, raw] = await Promise.all([
      database.collection('telemetry_monthly').find({
        ...baseFilter, '_id.month': { $gte: from, $lt: to }
      }).toArray(),
      database.collection('telemetry_daily').find({
        ...baseFilter, '_id.day': { $gte: from, $lt: to }
      }).toArray(),
      rawPoints(farm._id, sensorType, hotFrom, rawTo, 'day')
    ]);
    // An open month is rebuilt from warm and hot data so a partial cold rollup cannot hide new readings.
    points = summarize(cold.filter((item) => item.complete === true && vietnamMonthWindow(item.monthLocal).to <= now), 'cold', 'month');
    const warmByDay = summarize(warm, 'warm', 'day');
    const rawByDay = summarize(raw, 'hot', 'day');
    addMissing(warmByDay, rawByDay);
    const missingMonths = new Map();
    for (const point of warmByDay.values()) {
      const month = point.key.slice(0, 7);
      if (points.has(month)) continue;
      const total = missingMonths.get(month) || {
        at: vietnamMonthWindow(month).from, key: month, sum: 0, samples: 0,
        minimum: Infinity, maximum: -Infinity, tier: point.tier
      };
      total.sum += point.sum;
      total.samples += point.samples;
      total.minimum = Math.min(total.minimum, point.minimum);
      total.maximum = Math.max(total.maximum, point.maximum);
      if (point.tier !== total.tier) total.tier = 'mixed';
      missingMonths.set(month, total);
    }
    addMissing(points, missingMonths);
    resolution = 'month';
  }

  const formatted = formatPoints(points, resolution);
  return {
    period, value, from, to, timezone: TELEMETRY_TIMEZONE,
    farm: { code: farm.code, name: farm.name }, sensorType, unit: SENSOR_UNITS[sensorType],
    resolution, points: formatted,
    tiers: [...new Set(formatted.flatMap((point) => point.tier === 'mixed' ? ['hot', 'warm'] : [point.tier]))]
  };
}
