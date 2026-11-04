import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { promises as files } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import mongoose from 'mongoose';
import { Telemetry } from '../models/index.js';

export const TELEMETRY_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 24 * 60 * 60 * 1000;
const RAW_RETENTION_DAYS = 30;
export const WARM_RETENTION_DAYS = 400;
const SENSOR_TYPES = ['temperature', 'humidity', 'soil_ph', 'pump_current'];
const { EJSON } = mongoose.mongo.BSON;

export function vietnamDayWindow(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('day must be YYYY-MM-DD');
  const from = new Date(`${day}T00:00:00+07:00`);
  if (Number.isNaN(from.getTime()) || new Date(from.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) !== day) {
    throw new Error('day is not a valid calendar date');
  }
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

export function vietnamMonthWindow(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('month must be YYYY-MM');
  const [year, number] = month.split('-').map(Number);
  if (year < 1970 || year > 2100) throw new Error('month is outside the supported year range');
  const from = new Date(`${month}-01T00:00:00+07:00`);
  const next = new Date(Date.UTC(year, number, 1, -7));
  return { from, to: next };
}

export async function ensureTelemetryTierIndexes() {
  const database = Telemetry.db;
  await Promise.all([
    database.collection('telemetry_daily').createIndex(
      { expiresAt: 1 }, { expireAfterSeconds: 0, name: 'warm_ttl' }
    ),
    database.collection('telemetry_daily').createIndex(
      { farmCode: 1, '_id.sensorType': 1, '_id.day': 1 }, { name: 'warm_filter' }
    ),
    database.collection('telemetry_monthly').createIndex(
      { farmCode: 1, '_id.sensorType': 1, '_id.month': 1 }, { name: 'cold_filter' }
    )
  ]);
}

function sourceMatch(day, farmCode, rollup = false) {
  const { from, to } = vietnamDayWindow(day);
  return {
    capturedAt: { $gte: from, $lt: to },
    ...(rollup ? { 'meta.sensorType': { $in: SENSOR_TYPES } } : { 'meta.farmId': { $exists: true } }),
    ...(farmCode ? { 'meta.farmCode': farmCode } : {})
  };
}

function assertSafeSourceWindow(day, now = new Date()) {
  const { from, to } = vietnamDayWindow(day);
  if (to > now) throw new Error('Only completed Vietnam calendar days can be archived or rolled up');
  if (from < new Date(now.getTime() - (RAW_RETENTION_DAYS - 1) * DAY_MS)) {
    throw new Error('Day may already have lost raw readings to the 30-day TTL; use a newer day');
  }
}

export function dailyRollupPipeline(day, farmCode, rolledUpAt = new Date()) {
  return [
    { $match: sourceMatch(day, farmCode, true) },
    {
      $group: {
        _id: {
          day: { $dateTrunc: { date: '$capturedAt', unit: 'day', timezone: TELEMETRY_TIMEZONE } },
          farmId: '$meta.farmId',
          deviceId: '$meta.deviceId',
          sensorType: '$meta.sensorType'
        },
        farmCode: { $first: '$meta.farmCode' },
        unit: { $first: '$unit' },
        samples: { $sum: 1 },
        sum: { $sum: '$value' },
        average: { $avg: '$value' },
        minimum: { $min: '$value' },
        maximum: { $max: '$value' }
      }
    },
    {
      $project: {
        farmCode: 1,
        unit: 1,
        samples: 1,
        sum: 1,
        average: { $round: ['$average', 3] },
        minimum: 1,
        maximum: 1,
        dayLocal: { $dateToString: { format: '%Y-%m-%d', date: '$_id.day', timezone: TELEMETRY_TIMEZONE } },
        expiresAt: { $dateAdd: { startDate: '$_id.day', unit: 'day', amount: WARM_RETENTION_DAYS, timezone: TELEMETRY_TIMEZONE } },
        rolledUpAt: { $literal: rolledUpAt }
      }
    },
    { $merge: { into: 'telemetry_daily', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } }
  ];
}

export async function rollupTelemetryDay({ day, farmCode, now = new Date() }) {
  assertSafeSourceWindow(day, now);
  await ensureTelemetryTierIndexes();
  await Telemetry.aggregate(dailyRollupPipeline(day, farmCode, now)).allowDiskUse(true);
  const { from } = vietnamDayWindow(day);
  const filter = { '_id.day': from, ...(farmCode ? { farmCode } : {}) };
  const series = await Telemetry.db.collection('telemetry_daily').countDocuments(filter);
  await Telemetry.db.collection('telemetry_rollup_runs').updateOne(
    { _id: `${day}:${farmCode || '*'}` },
    { $set: { day, scope: farmCode || '*', series, completedAt: now } },
    { upsert: true }
  );
  return { day, timezone: TELEMETRY_TIMEZONE, series, collection: 'telemetry_daily' };
}

export function monthlyRollupPipeline(month, farmCode, rolledUpAt = new Date(), complete = false) {
  const { from, to } = vietnamMonthWindow(month);
  return [
    { $match: {
      '_id.day': { $gte: from, $lt: to },
      '_id.sensorType': { $in: SENSOR_TYPES },
      ...(farmCode ? { farmCode } : {})
    } },
    { $group: {
      _id: {
        month: { $dateTrunc: { date: '$_id.day', unit: 'month', timezone: TELEMETRY_TIMEZONE } },
        farmId: '$_id.farmId',
        deviceId: '$_id.deviceId',
        sensorType: '$_id.sensorType'
      },
      farmCode: { $first: '$farmCode' },
      unit: { $first: '$unit' },
      days: { $sum: 1 },
      samples: { $sum: '$samples' },
      sum: { $sum: { $ifNull: ['$sum', { $multiply: ['$average', '$samples'] }] } },
      minimum: { $min: '$minimum' },
      maximum: { $max: '$maximum' }
    } },
    { $project: {
      farmCode: 1,
      unit: 1,
      days: 1,
      samples: 1,
      sum: 1,
      average: { $round: [{ $divide: ['$sum', '$samples'] }, 3] },
      minimum: 1,
      maximum: 1,
      monthLocal: { $dateToString: { format: '%Y-%m', date: '$_id.month', timezone: TELEMETRY_TIMEZONE } },
      complete: { $literal: complete },
      rolledUpAt: { $literal: rolledUpAt }
    } },
    { $merge: { into: 'telemetry_monthly', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } }
  ];
}

export async function rollupTelemetryMonth({ month, farmCode, now = new Date() }) {
  const { from, to } = vietnamMonthWindow(month);
  if (from >= now) throw new Error('Month has not started');
  if (to < new Date(now.getTime() - (WARM_RETENTION_DAYS - 1) * DAY_MS)) {
    throw new Error('Month may already have lost daily rollups to warm TTL');
  }
  await ensureTelemetryTierIndexes();
  const expectedDays = [];
  for (let timestamp = from.getTime(); timestamp < to.getTime(); timestamp += DAY_MS) {
    expectedDays.push(new Date(timestamp + 7 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }
  const scopes = farmCode ? [farmCode, '*'] : ['*'];
  const runIds = expectedDays.flatMap((day) => scopes.map((scope) => `${day}:${scope}`));
  const runs = await Telemetry.db.collection('telemetry_rollup_runs').find(
    { _id: { $in: runIds } }, { projection: { day: 1 } }
  ).toArray();
  const processedDays = new Set(runs.map((run) => run.day));
  const missingDays = expectedDays.filter((day) => !processedDays.has(day));
  const complete = to <= now && missingDays.length === 0;
  await Telemetry.db.collection('telemetry_daily').aggregate(
    monthlyRollupPipeline(month, farmCode, now, complete), { allowDiskUse: true }
  ).toArray();
  const filter = { '_id.month': from, ...(farmCode ? { farmCode } : {}) };
  const series = await Telemetry.db.collection('telemetry_monthly').countDocuments(filter);
  return { month, timezone: TELEMETRY_TIMEZONE, series, collection: 'telemetry_monthly', complete, missingDays };
}

export async function runTelemetryCycle({ now = new Date() } = {}) {
  const today = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const yesterday = new Date(vietnamDayWindow(today).from.getTime() - 1 + 7 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const daily = await rollupTelemetryDay({ day: yesterday, now });
  const monthly = await rollupTelemetryMonth({ month: yesterday.slice(0, 7), now });
  return { daily, monthly };
}

export async function archiveTelemetryDay({ day, farmCode, outputDir, now = new Date() }) {
  assertSafeSourceWindow(day, now);
  if (!outputDir) throw new Error('outputDir is required');
  if (farmCode && !/^[a-zA-Z0-9_-]+$/.test(farmCode)) throw new Error('farmCode contains invalid filename characters');
  const directory = path.resolve(outputDir);
  await files.mkdir(directory, { recursive: true });
  const name = `telemetry-${day}-${farmCode || 'all'}.ndjson`;
  const output = path.join(directory, name);
  const manifestPath = `${output}.manifest.json`;
  for (const file of [output, manifestPath]) {
    if (await files.stat(file).then(() => true, (error) => {
      if (error.code === 'ENOENT') return false;
      throw error;
    })) throw new Error(`Archive already exists: ${file}`);
  }

  const temporary = `${output}.${randomUUID()}.part`;
  const cursor = Telemetry.collection.find(sourceMatch(day, farmCode), { batchSize: 1000 });
  const hash = createHash('sha256');
  const stream = fs.createWriteStream(temporary, { flags: 'wx', encoding: 'utf8' });
  let documents = 0;
  let bytes = 0;
  let archived = false;
  try {
    for await (const document of cursor) {
      const line = `${EJSON.stringify(document, null, 0, { relaxed: false })}\n`;
      hash.update(line);
      bytes += Buffer.byteLength(line);
      documents += 1;
      if (!stream.write(line)) await once(stream, 'drain');
    }
    await new Promise((resolve, reject) => {
      stream.once('error', reject);
      stream.end(resolve);
    });
    if (documents === 0) throw new Error('No telemetry found for this day; no archive was created');

    const manifest = {
      day,
      timezone: TELEMETRY_TIMEZONE,
      farmCode: farmCode || null,
      collection: 'telemetry_ts',
      format: 'MongoDB Extended JSON, one document per line',
      file: name,
      documents,
      bytes,
      sha256: hash.digest('hex'),
      archivedAt: now.toISOString()
    };
    await files.link(temporary, output);
    archived = true;
    await files.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    return { ...manifest, output, manifestPath };
  } catch (error) {
    if (archived) await files.unlink(output);
    throw error;
  } finally {
    await cursor.close();
    stream.destroy();
    await files.unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}
