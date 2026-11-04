import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Incident, PumpCommand, Telemetry } from '../models/index.js';

dotenv.config();

async function countAggregation(model, pipeline) {
  const [result] = await model.aggregate([...pipeline, { $count: 'count' }]);
  return result?.count || 0;
}

function findExecutionStats(explain) {
  if (explain.executionStats) return explain.executionStats;
  for (const stage of explain.stages || []) {
    if (stage.$cursor?.executionStats) return stage.$cursor.executionStats;
  }
  return null;
}

let report;
try {
  const connection = await connectDatabase();
  const collectionInfo = await connection.db.listCollections({ name: 'telemetry_ts' }).next();
  if (!collectionInfo) throw new Error('telemetry_ts does not exist');
  const [warmInfo, coldInfo] = await Promise.all([
    connection.db.listCollections({ name: 'telemetry_daily' }).next(),
    connection.db.listCollections({ name: 'telemetry_monthly' }).next()
  ]);

  const [sample, telemetryDocuments, invalidTelemetry, invalidCommands, invalidIncidents, duplicateActiveIncidents] = await Promise.all([
    Telemetry.findOne().sort({ capturedAt: -1 }).lean(),
    Telemetry.estimatedDocumentCount(),
    countAggregation(Telemetry, [{
      $match: {
        $or: [
          { capturedAt: { $exists: false } },
          { 'meta.farmId': { $exists: false } },
          { 'meta.deviceId': { $in: [null, ''] } },
          { 'meta.sensorType': 'temperature', value: { $not: { $gte: -20, $lte: 60 } } },
          { 'meta.sensorType': 'humidity', value: { $not: { $gte: 0, $lte: 100 } } },
          { 'meta.sensorType': 'soil_ph', value: { $not: { $gte: 0, $lte: 14 } } },
          { 'meta.sensorType': 'pump_current', value: { $not: { $gte: 0, $lte: 20 } } }
        ]
      }
    }]),
    countAggregation(PumpCommand, [{
      $match: {
        status: 'effect_confirmed',
        $or: [
          { acknowledgedAt: null },
          { effectConfirmedAt: null },
          { 'acknowledgement.pumpCurrentAmp': { $lte: 0 } }
        ]
      }
    }]),
    countAggregation(Incident, [{
      $match: {
        status: 'resolved',
        $or: [
          { resolvedAt: null },
          { 'recoveryEvidence.ackReceived': { $ne: true } },
          { 'recoveryEvidence.pumpCurrentAmp': { $lte: 0 } },
          { $expr: { $lte: ['$recoveryEvidence.moistureAfter', '$recoveryEvidence.moistureBefore'] } }
        ]
      }
    }]),
    Incident.aggregate([
      { $match: { status: { $in: ['open', 'mitigating'] } } },
      { $group: { _id: { farm: '$farm', type: '$type' }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'count' }
    ]).then(([result]) => result?.count || 0)
  ]);

  let canonicalQuery = { status: 'skipped', reason: 'No telemetry documents' };
  if (sample) {
    const from = new Date(sample.capturedAt.getTime() - 60 * 60 * 1000);
    const to = new Date(sample.capturedAt.getTime() + 1000);
    const explain = await Telemetry.collection
      .find({
        'meta.farmId': sample.meta.farmId,
        'meta.sensorType': sample.meta.sensorType,
        capturedAt: { $gte: from, $lte: to }
      })
      .sort({ capturedAt: -1 })
      .limit(30)
      .explain('executionStats');
    const stats = findExecutionStats(explain);
    canonicalQuery = {
      status: stats ? 'measured' : 'explain-unavailable',
      totalDocsExamined: stats?.totalDocsExamined ?? null,
      totalKeysExamined: stats?.totalKeysExamined ?? null,
      returned: stats?.nReturned ?? null,
      boundedByMetaAndTime: true
    };
  }

  const [warmIndexes, warmSeries, coldSeries, completeColdSeries, latestDailyRun] = await Promise.all([
    warmInfo ? connection.db.collection('telemetry_daily').indexes() : [],
    warmInfo ? connection.db.collection('telemetry_daily').estimatedDocumentCount() : 0,
    coldInfo ? connection.db.collection('telemetry_monthly').estimatedDocumentCount() : 0,
    coldInfo ? connection.db.collection('telemetry_monthly').countDocuments({ complete: true }) : 0,
    connection.db.collection('telemetry_rollup_runs').findOne({}, { sort: { completedAt: -1 } })
  ]);
  const warmTtlIndex = warmIndexes.find((index) => index.name === 'warm_ttl');

  const failures = [];
  if (!collectionInfo.options?.timeseries) failures.push('telemetry_ts is not a time-series collection');
  if (collectionInfo.options?.timeseries?.timeField !== 'capturedAt') failures.push('unexpected timeField');
  if (collectionInfo.options?.timeseries?.metaField !== 'meta') failures.push('unexpected metaField');
  if (collectionInfo.options?.timeseries?.granularity !== 'seconds') failures.push('unexpected time-series granularity');
  if (collectionInfo.options?.expireAfterSeconds !== 30 * 24 * 60 * 60) failures.push('unexpected raw telemetry TTL');
  if (warmInfo && warmTtlIndex?.expireAfterSeconds !== 0) failures.push('warm tier TTL index is missing');
  if (invalidTelemetry > 0) failures.push(`${invalidTelemetry} invalid telemetry documents`);
  if (invalidCommands > 0) failures.push(`${invalidCommands} effect-confirmed commands lack physical evidence`);
  if (invalidIncidents > 0) failures.push(`${invalidIncidents} resolved incidents lack recovery evidence`);
  if (duplicateActiveIncidents > 0) failures.push(`${duplicateActiveIncidents} duplicate active incident groups`);

  report = {
    valid: failures.length === 0,
    checkedAt: new Date().toISOString(),
    collection: {
      name: collectionInfo.name,
      type: collectionInfo.type,
      timeseries: collectionInfo.options?.timeseries,
      expireAfterSeconds: collectionInfo.options?.expireAfterSeconds,
      telemetryDocuments
    },
    tiers: {
      hot: { collection: 'telemetry_ts', documents: telemetryDocuments, ttlDays: 30 },
      warm: { collection: 'telemetry_daily', documents: warmSeries, ttlDays: warmTtlIndex ? 400 : null, ttlIndexPresent: Boolean(warmTtlIndex) },
      cold: { collection: 'telemetry_monthly', documents: coldSeries, completeDocuments: completeColdSeries, ttlDays: null },
      latestDailyRun: latestDailyRun?.completedAt || null
    },
    invariants: { invalidTelemetry, invalidCommands, invalidIncidents, duplicateActiveIncidents },
    canonicalQuery,
    failures
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
