import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MongoMemoryServer } from 'mongodb-memory-server';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const execFileAsync = promisify(execFile);

process.env.NODE_ENV = 'test';
process.env.SIMULATOR_ENABLED = 'true';
process.env.SIMULATOR_TICK_MS = '200';
process.env.SIMULATOR_ACK_TIMEOUT_MS = '600';
process.env.SIMULATOR_EFFECT_TIMEOUT_MS = '600';

let mongo;
let disconnectDatabase;
let iotMvpService;
let mongoUri;

try {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.24' } });
  mongoUri = mongo.getUri('smart_farm_iot_test');
  const database = await import('../config/database.js');
  const models = await import('../models/index.js');
  ({ iotMvpService } = await import('../services/IotMvpService.js'));
  disconnectDatabase = database.disconnectDatabase;

  await database.connectDatabase(mongoUri);
  const user = await models.User.create({
    fullName: 'Smoke Test Operator',
    email: 'smoke@example.com',
    passwordHash: 'not-a-real-login-hash',
    role: 'operator'
  });
  const farm = await models.Farm.create({
    name: 'Smoke Test Farm',
    code: 'FARM-002',
    owner: user._id,
    cropType: 'Tomato',
    location: { address: 'Demo zone', city: 'Da Lat', country: 'Vietnam' },
    thresholds: { humidityMin: 50, pumpRunMinutes: 30 },
    pump: { status: 'off', mode: 'auto' }
  });

  await models.Sensor.insertMany([
    { farm: farm._id, name: 'Temperature', type: 'temperature', unit: 'celsius', deviceId: 'temp-1', mqttTopic: 'test/temp', lastValue: 28 },
    { farm: farm._id, name: 'Moisture', type: 'humidity', unit: 'percent', deviceId: 'humidity-1', mqttTopic: 'test/humidity', lastValue: 52 },
    { farm: farm._id, name: 'Soil pH', type: 'soil_ph', unit: 'ph', deviceId: 'ph-1', mqttTopic: 'test/ph', lastValue: 6.5 }
  ]);

  await iotMvpService.start();
  await iotMvpService.startAckTimeoutScenario('FARM-002');
  await wait(1400);

  let snapshot = await iotMvpService.getSnapshot();
  let demoFarm = snapshot.farms[0];
  assert.equal(demoFarm.pumpState.commandStatus, 'ack_timeout');
  assert.equal(demoFarm.pumpState.controllerOnline, false);
  assert.equal(demoFarm.incident.status, 'open');

  const incidentId = demoFarm.incident.id;
  const commandsBeforeRestart = await models.PumpCommand.countDocuments();
  iotMvpService.stop();
  iotMvpService.states.clear();
  await iotMvpService.start();
  await wait(400);
  assert.equal(await models.PumpCommand.countDocuments(), commandsBeforeRestart, 'Restart must not create a command storm');
  snapshot = await iotMvpService.getSnapshot();
  demoFarm = snapshot.farms[0];
  assert.equal(demoFarm.incident.id, incidentId, 'Active incident must survive worker restart');
  assert.equal(demoFarm.pumpState.controllerOnline, false);

  await iotMvpService.restorePumpController('FARM-002');
  await iotMvpService.retryIncident(incidentId);
  await wait(1000);

  snapshot = await iotMvpService.getSnapshot();
  demoFarm = snapshot.farms[0];
  const resolvedIncident = snapshot.incidents.find((incident) => incident.id === incidentId);
  assert.equal(demoFarm.pumpState.commandStatus, 'effect_confirmed');
  assert.equal(demoFarm.pumpState.acknowledged, true);
  assert.equal(demoFarm.pumpState.currentAmp, 1.8);
  assert.equal(resolvedIncident.status, 'resolved');
  assert.equal(resolvedIncident.recoveryEvidence.ackReceived, true);
  assert.ok(resolvedIncident.recoveryEvidence.moistureAfter > resolvedIncident.recoveryEvidence.moistureBefore);
  const evidence = await iotMvpService.getIncidentEvidence(incidentId);
  assert.equal(evidence.recovered, true);
  assert.ok(evidence.phases.some((phase) => phase.samples > 0));
  assert.equal(evidence.recoveryEvidence.recovered, true);
  assert.ok(evidence.timeline.some((reading) => reading.pumpCurrent > 0));

  await iotMvpService.startSilentFailureScenario('FARM-002');
  await wait(1500);
  snapshot = await iotMvpService.getSnapshot();
  demoFarm = snapshot.farms[0];
  assert.equal(demoFarm.pumpState.controllerOnline, true);
  assert.equal(demoFarm.pumpState.powerAvailable, false);
  assert.equal(demoFarm.pumpState.acknowledged, true);
  assert.equal(demoFarm.pumpState.currentAmp, 0);
  assert.equal(demoFarm.incident.type, 'pump_no_effect');
  const silentIncidentId = demoFarm.incident.id;
  const silentEvidence = await iotMvpService.getIncidentEvidence(silentIncidentId);
  assert.equal(silentEvidence.recovered, false);
  assert.ok(silentEvidence.command.acknowledgedAt);
  assert.ok(silentEvidence.timeline.some((reading) => reading.pumpCurrent === 0));
  await assert.rejects(iotMvpService.retryIncident(silentIncidentId), /Restore the controller and pump power/);

  await iotMvpService.restorePumpController('FARM-002');
  await iotMvpService.retryIncident(silentIncidentId);
  await wait(1000);
  const repairedEvidence = await iotMvpService.getIncidentEvidence(silentIncidentId);
  assert.equal(repairedEvidence.recovered, true);
  assert.equal(repairedEvidence.commands.length, 2);
  assert.notEqual(repairedEvidence.commands[0].commandId, repairedEvidence.commands[1].commandId);
  assert.notEqual(repairedEvidence.commands[0].idempotencyKey, repairedEvidence.commands[1].idempotencyKey);
  assert.ok(repairedEvidence.commands[0].acknowledgedAt);
  assert.equal(repairedEvidence.commands[0].effectConfirmedAt, null);
  assert.ok(repairedEvidence.commands[1].effectConfirmedAt);
  assert.ok(repairedEvidence.recoveryEvidence.pumpCurrentAmp > 0);
  assert.ok(repairedEvidence.recoveryEvidence.moistureAfter > repairedEvidence.recoveryEvidence.moistureBefore);
  const validatorPath = fileURLToPath(new URL('../scripts/validateOperationalData.js', import.meta.url));
  const validation = await execFileAsync(process.execPath, [validatorPath], {
    env: { ...process.env, MONGODB_URI: mongoUri, NODE_ENV: 'test' }
  });
  assert.match(validation.stdout, /"valid": true/);

  console.log('MVP smoke test passed: ACK timeout and silent failure both recover from MongoDB telemetry.');
} finally {
  iotMvpService?.stop();
  if (disconnectDatabase) await disconnectDatabase();
  if (mongo) await mongo.stop();
}
