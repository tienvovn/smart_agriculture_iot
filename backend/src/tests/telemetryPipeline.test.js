import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
delete process.env.MQTT_URL;

let mongo;
let disconnectDatabase;
let pipeline;

try {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  const database = await import('../config/database.js');
  const { Farm, Telemetry, TelemetryAnomaly, TelemetryEvent, User } = await import('../models/index.js');
  ({ telemetryPipelineService: pipeline } = await import('../services/TelemetryPipelineService.js'));
  disconnectDatabase = database.disconnectDatabase;
  await database.connectDatabase(mongo.getUri('farmguard_pipeline_test'));
  await Promise.all([Telemetry.init(), TelemetryAnomaly.init(), TelemetryEvent.init()]);
  const user = await User.create({
    fullName: 'Pipeline Test', email: `${randomUUID()}@example.com`,
    passwordHash: 'test-only', role: 'operator'
  });
  await Farm.create({
    name: 'Pipeline Farm', code: 'FARM-002', owner: user._id,
    cropType: 'Tomato', location: { city: 'Da Lat', country: 'Vietnam' },
    pump: { status: 'off', mode: 'auto' }
  });
  await pipeline.start();
  assert.equal(pipeline.mode, 'change-stream');

  const start = Date.now();
  for (let index = 0; index < 13; index += 1) {
    const payload = {
      messageId: `pipeline-${index}`,
      deviceId: 'FARM-002-LEAFY-DEMO',
      capturedAt: new Date(start + index).toISOString(),
      temperature: index === 12 ? 43 : 28 + ((index % 3) - 1) * 0.1
    };
    const accepted = await pipeline.ingestMqtt('farmguard/FARM-002/telemetry', Buffer.from(JSON.stringify(payload)));
    assert.equal(accepted.duplicate, false);
  }

  assert.equal(await Telemetry.countDocuments({ source: 'mqtt' }), 13);
  const storage = await pipeline.storageStats();
  assert.equal(storage.measurements, 13);
  assert.ok(storage.logicalBytes > 0);
  assert.ok(storage.allocatedBytes > 0);
  assert.ok(storage.bucketCount > 0);
  assert.equal(await TelemetryAnomaly.countDocuments(), 1);
  const anomaly = await TelemetryAnomaly.findOne().lean();
  assert.equal(anomaly.sensorType, 'temperature');
  assert.equal(anomaly.sampleCount, 12);
  assert.ok(anomaly.zScore > 3);
  assert.equal(anomaly.value, 43);
  assert.equal((await pipeline.ingestMqtt('farmguard/FARM-002/telemetry', Buffer.from(JSON.stringify({
    messageId: 'pipeline-12', deviceId: 'FARM-002-LEAFY-DEMO',
    capturedAt: new Date(start + 12).toISOString(), temperature: 43
  })))).duplicate, true);
  assert.equal(await Telemetry.countDocuments({ source: 'mqtt' }), 13);
  await assert.rejects(pipeline.ingestMqtt('farmguard/FARM-002/telemetry', Buffer.from(JSON.stringify({
    messageId: 'invalid-1', deviceId: 'FARM-002-LEAFY-DEMO',
    capturedAt: new Date().toISOString(), temperature: 1000
  }))), /Invalid temperature/);
  console.log('Telemetry pipeline test passed: MQTT ingress, Time Series, Change Stream, anomaly, deduplication.');
} finally {
  if (pipeline) await pipeline.stop();
  if (disconnectDatabase) await disconnectDatabase();
  if (mongo) await mongo.stop();
}
