import assert from 'node:assert/strict';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Short windows so the test runs in a few seconds.
process.env.HARDWARE_EFFECT_WINDOW_MS = '1500';
process.env.HARDWARE_MIN_MOISTURE_RISE = '3';
process.env.HARDWARE_STALE_MS = '400';
process.env.SIMULATOR_ENABLED = 'false';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const buf = (value) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value));

let mongo;
let disconnectDatabase;
let bridge;

try {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24' } });
  const database = await import('../config/database.js');
  const models = await import('../models/index.js');
  ({ hardwareBridgeService: bridge } = await import('../services/HardwareBridgeService.js'));
  const { iotMvpService } = await import('../services/IotMvpService.js');
  disconnectDatabase = database.disconnectDatabase;
  await database.connectDatabase(mongo.getUri('farmguard_hw_test'));
  await models.Incident.init();

  const user = await models.User.create({
    fullName: 'HW Operator', email: 'hw@example.com', passwordHash: 'not-a-real-login-hash', role: 'operator'
  });
  const farm = await models.Farm.create({
    name: 'ESP32 Garden', code: 'FARM-HW', owner: user._id, cropType: 'Lettuce',
    location: { address: 'Lab bench', city: 'HCMC', country: 'Vietnam', geo: { type: 'Point', coordinates: [106.7, 10.8] } },
    thresholds: { humidityMin: 35, pumpRunMinutes: 10 }, pump: { status: 'off', mode: 'auto' }
  });
  await bridge.register('garden01', farm);
  const send = (suffix, payload) => bridge.route(`smartgarden/garden01/${suffix}`, buf(payload));

  // 1. Firmware JSON with a DHT22 read error (`nan`) is accepted; soil still recorded.
  await send('telemetry', '{"temperature":nan,"humidity":nan,"soil":30.00,"pump":false}');
  let snapshot = await iotMvpService.getSnapshot();
  let hwFarm = snapshot.farms.find((item) => item.code === 'FARM-HW');
  assert.equal(hwFarm.source, 'hardware');
  assert.equal(hwFarm.online, true);
  assert.equal(await models.Telemetry.countDocuments({ 'meta.farmCode': 'FARM-HW', source: 'hardware' }), 2);

  // 2. Relay switches ON locally (AUTO mode). The state topic floods; only the change is recorded.
  for (let i = 0; i < 50; i += 1) await send('pump/state', 'ON');
  const activations = await models.PumpCommand.find({ farm: farm._id });
  assert.equal(activations.length, 1, 'pump/state flood must create exactly one activation');
  assert.equal(activations[0].status, 'acknowledged');

  // 3. Relay ON but soil does not rise for the whole effect window -> silent failure.
  for (const soil of [30, 29.8, 30.1, 29.9]) {
    await send('telemetry', { temperature: 29, humidity: 70, soil, pump: true });
    await wait(150);
  }
  await wait(1200);
  await send('telemetry', { temperature: 29, humidity: 70, soil: 29.7, pump: true });
  const incident = await models.Incident.findOne({ farm: farm._id });
  assert.ok(incident, 'silent failure incident must be opened');
  assert.equal(incident.type, 'pump_no_effect');
  assert.equal(incident.status, 'open');
  assert.ok(incident.impactStartedAt, 'impact starts when the relay switched ON');

  // 4. Water starts flowing (pump put back in the tank): soil rises -> resolved with evidence.
  for (const soil of [31.5, 33.4, 35.2, 37.0]) {
    await send('telemetry', { temperature: 29, humidity: 70, soil, pump: true });
  }
  const resolved = await models.Incident.findById(incident._id);
  assert.equal(resolved.status, 'resolved');
  assert.ok(resolved.recoveryEvidence.moistureAfter - resolved.recoveryEvidence.moistureBefore >= 3);
  const confirmed = await models.PumpCommand.findById(activations[0]._id);
  assert.equal(confirmed.status, 'effect_confirmed');

  const kpis = await iotMvpService.getIncidentKpis({ hours: 1 });
  assert.equal(kpis.incidents.resolved, 1);
  assert.ok(kpis.mttdSeconds > 0);

  // 5. Telemetry stops -> device goes offline.
  await wait(500);
  await bridge.checkHealth();
  snapshot = await iotMvpService.getSnapshot();
  hwFarm = snapshot.farms.find((item) => item.code === 'FARM-HW');
  assert.equal(hwFarm.online, false);
  assert.equal(bridge.status()[0].online, false);

  // 6. Commands need a live broker connection.
  await assert.rejects(bridge.sendCommand('FARM-HW', 'ON'), /broker is not connected/);
  // Simulated fault injection is refused on a real-hardware farm.
  await assert.rejects(iotMvpService.startSilentFailureScenario('FARM-HW'), /real hardware/);

  console.log('Hardware bridge test passed: firmware JSON, relay flood, silent failure, recovery, offline.');
} finally {
  await bridge?.stop();
  if (disconnectDatabase) await disconnectDatabase();
  if (mongo) await mongo.stop();
}
