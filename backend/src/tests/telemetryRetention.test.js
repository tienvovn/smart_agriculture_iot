import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as files } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Farm, Telemetry, User } from '../models/index.js';
import { getTelemetryTrend } from '../services/TelemetryTrendService.js';
import {
  archiveTelemetryDay,
  rollupTelemetryDay,
  rollupTelemetryMonth,
  runTelemetryCycle,
  vietnamDayWindow,
  vietnamMonthWindow
} from '../services/TelemetryRetentionService.js';

process.env.NODE_ENV = 'test';
const now = new Date('2026-10-18T00:00:00.000Z');
const day = '2026-10-16';
const farmId = new mongoose.Types.ObjectId();
const outputDir = await files.mkdtemp(path.join(os.tmpdir(), 'farmguard-retention-'));
let mongo;

function reading(capturedAt, sensorType, value) {
  return {
    capturedAt: new Date(capturedAt),
    meta: { farmId, farmCode: 'TEST-001', deviceId: `TEST-001-${sensorType}`, sensorType },
    value,
    unit: sensorType === 'humidity' ? 'percent' : 'ampere',
    messageId: `${sensorType}-${capturedAt}`,
    source: 'simulator',
    quality: 'good'
  };
}

try {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24' } });
  await connectDatabase(mongo.getUri('retention_test'));
  const user = await User.create({
    fullName: 'Retention Test Operator', email: 'retention@example.com',
    passwordHash: 'not-a-real-login-hash', role: 'operator'
  });
  await Farm.create({
    _id: farmId, name: 'Retention Test Farm', code: 'TEST-001', owner: user._id,
    cropType: 'Tomato', location: { city: 'Da Lat', country: 'Vietnam' }
  });
  await Telemetry.createCollection();
  await Telemetry.insertMany([
    reading('2026-10-15T16:59:59.000Z', 'humidity', 10),
    reading('2026-10-15T17:00:00.000Z', 'humidity', 40),
    reading('2026-10-16T16:59:59.000Z', 'humidity', 60),
    reading('2026-10-16T16:59:59.000Z', 'pump_current', 1.8),
    reading('2026-10-16T17:00:00.000Z', 'humidity', 90)
  ], { ordered: false });

  assert.equal(vietnamDayWindow(day).from.toISOString(), '2026-10-15T17:00:00.000Z');
  assert.equal(vietnamDayWindow(day).to.toISOString(), '2026-10-16T17:00:00.000Z');
  assert.equal(vietnamMonthWindow('2026-10').from.toISOString(), '2026-09-30T17:00:00.000Z');
  assert.equal(vietnamMonthWindow('2026-10').to.toISOString(), '2026-10-31T17:00:00.000Z');
  assert.throws(() => vietnamDayWindow('2026-02-30'), /valid calendar date/);

  const first = await rollupTelemetryDay({ day, now });
  assert.equal(first.series, 2);
  const humidity = await mongoose.connection.db.collection('telemetry_daily').findOne({ '_id.sensorType': 'humidity' });
  assert.equal(humidity.dayLocal, day);
  assert.equal(humidity.samples, 2);
  assert.equal(humidity.average, 50);
  assert.equal(humidity.minimum, 40);
  assert.equal(humidity.maximum, 60);
  assert.equal(humidity.sum, 100);
  assert.ok(humidity.expiresAt instanceof Date);
  const warmIndexes = await mongoose.connection.db.collection('telemetry_daily').indexes();
  assert.ok(warmIndexes.some((index) => index.name === 'warm_ttl' && index.expireAfterSeconds === 0));
  assert.equal(humidity._id.day.toISOString(), '2026-10-15T17:00:00.000Z');

  await rollupTelemetryDay({ day, now });
  assert.equal(await mongoose.connection.db.collection('telemetry_daily').countDocuments(), 2);
  const monthRollup = await rollupTelemetryMonth({ month: '2026-10', now });
  assert.equal(monthRollup.series, 2);
  const monthlyHumidity = await mongoose.connection.db.collection('telemetry_monthly').findOne({ '_id.sensorType': 'humidity' });
  assert.equal(monthlyHumidity.monthLocal, '2026-10');
  assert.equal(monthlyHumidity.samples, 2);
  assert.equal(monthlyHumidity.average, 50);
  assert.equal(monthlyHumidity.complete, false);
  await rollupTelemetryMonth({ month: '2026-10', now });
  assert.equal(await mongoose.connection.db.collection('telemetry_monthly').countDocuments(), 2);

  const dayTrend = await getTelemetryTrend({ period: 'day', value: day, farmCode: 'TEST-001', sensorType: 'humidity', now });
  assert.equal(dayTrend.resolution, 'hour');
  assert.equal(dayTrend.points.length, 2);
  assert.deepEqual(dayTrend.tiers, ['hot']);
  const monthTrend = await getTelemetryTrend({ period: 'month', value: '2026-10', farmCode: 'TEST-001', sensorType: 'humidity', now });
  assert.equal(monthTrend.points.length, 3);
  assert.deepEqual(monthTrend.tiers.sort(), ['hot', 'warm']);
  const yearTrend = await getTelemetryTrend({ period: 'year', value: '2026', farmCode: 'TEST-001', sensorType: 'humidity', now });
  assert.equal(yearTrend.resolution, 'month');
  assert.equal(yearTrend.points.length, 1);
  assert.equal(yearTrend.points[0].samples, 4);
  assert.equal(yearTrend.points[0].average, 50);
  assert.deepEqual(yearTrend.tiers.sort(), ['hot', 'warm']);
  const cycle = await runTelemetryCycle({ now });
  assert.equal(cycle.daily.day, '2026-10-17');
  assert.equal(cycle.monthly.month, '2026-10');
  const server = app.listen(0);
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/iot/telemetry/trend?period=month&value=2026-10&farmCode=TEST-001&sensorType=humidity`);
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.data.points.length, 3);
    const invalid = await fetch(`http://127.0.0.1:${address.port}/api/iot/telemetry/trend?period=month&value=2026-13&farmCode=TEST-001&sensorType=humidity`);
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  // Simulate the daily maintenance cycle for every day, including days with no readings.
  for (let date = 1; date <= 31; date += 1) {
    const scheduledDay = `2026-10-${String(date).padStart(2, '0')}`;
    const completedAt = new Date(vietnamDayWindow(scheduledDay).to.getTime() + 1000);
    await rollupTelemetryDay({ day: scheduledDay, now: completedAt });
  }
  const closedMonth = await rollupTelemetryMonth({ month: '2026-10', now: new Date('2026-11-01T00:00:00.000Z') });
  assert.equal(closedMonth.complete, true);
  assert.deepEqual(closedMonth.missingDays, []);
  const later = new Date('2026-12-01T00:00:00.000Z');
  const coldYear = await getTelemetryTrend({ period: 'year', value: '2026', farmCode: 'TEST-001', sensorType: 'humidity', now: later });
  assert.deepEqual(coldYear.tiers, ['cold']);
  assert.equal(coldYear.points[0].samples, 4);
  assert.equal(coldYear.points[0].average, 50);
  const warmDay = await getTelemetryTrend({ period: 'day', value: day, farmCode: 'TEST-001', sensorType: 'humidity', now: later });
  assert.deepEqual(warmDay.tiers, ['warm']);
  assert.equal(warmDay.points[0].samples, 2);

  const archive = await archiveTelemetryDay({ day, now, outputDir });
  assert.equal(archive.documents, 3);
  const bytes = await files.readFile(archive.output);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), archive.sha256);
  assert.equal(bytes.toString().trim().split('\n').length, 3);
  assert.match(bytes.toString(), /"\$date"/);
  await assert.rejects(archiveTelemetryDay({ day, now, outputDir }), /already exists/);
  await assert.rejects(rollupTelemetryDay({ day: '2026-09-01', now }), /TTL/);
  console.log('Telemetry retention test passed: Vietnam boundaries, warm/cold rollups and verified raw archive.');
} finally {
  await disconnectDatabase();
  if (mongo) await mongo.stop();
  for (const name of await files.readdir(outputDir)) await files.unlink(path.join(outputDir, name));
  await files.rmdir(outputDir);
}
