import { randomUUID } from 'node:crypto';
import mqtt from 'mqtt';
import { Farm, Incident, PumpCommand, PumpLog, Sensor, Telemetry } from '../models/index.js';
import { hardwareConfig, hardwareDevices } from '../config/hardware.js';
import { AppError } from '../utils/AppError.js';
import { logEvent, metric, traceOperation } from '../utils/observability.js';
import { iotMvpService } from './IotMvpService.js';
import { realtimeService } from './RealtimeService.js';
import { telemetryPipelineService } from './TelemetryPipelineService.js';

// Bridges real ESP32 devices (IOT/SmartAgriculture firmware) into FarmGuard.
//
// Firmware MQTT contract (AppConfig.h):
//   <prefix>/<device>/telemetry      {"temperature":27.1,"humidity":61.0,"soil":42.5,"pump":true}  every 2.5 s
//   <prefix>/<device>/pump/state     "ON" | "OFF"   (published on every loop iteration)
//   <prefix>/<device>/status         "online"       (retained, on connect)
//   <prefix>/<device>/pump/command   "ON" | "OFF"   <- FarmGuard publishes
//   <prefix>/<device>/mode/command   "AUTO" | "MANUAL"
//
// The board has no pump-current sensor, so outcome assurance for hardware is:
//   relay ON (the controller's ACK)  +  soil moisture rises within the effect window.
// Relay ON for the whole window without a rise -> silent failure (pump_no_effect).

const ACTIVE_INCIDENT = { $in: ['open', 'mitigating'] };
const round = (value, decimals = 1) => Math.round(value * 10 ** decimals) / 10 ** decimals;

function parseFirmwareJson(payload) {
  // DHT22 read errors are printed by snprintf as `nan`, which is not valid JSON.
  const text = payload.toString('utf8').replace(/\b-?nan\b/gi, 'null');
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Telemetry must be a JSON object');
  return data;
}

function reading(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

class HardwareBridgeService {
  constructor() {
    this.client = null;
    this.devices = new Map(); // deviceId -> runtime state
    this.watchdog = null;
  }

  get enabled() {
    return this.devices.size > 0;
  }

  async start() {
    const mapping = hardwareDevices();
    if (mapping.size === 0) return;
    const url = hardwareConfig.mqttUrl();
    if (!url) {
      logEvent('warn', 'hardware.bridge_disabled', { reason: 'Set HARDWARE_MQTT_URL (or MQTT_URL) to reach the ESP32 broker.' });
      return;
    }

    // Connect even if some farms are missing (e.g. database not seeded yet): they are
    // registered as soon as they exist, without restarting the backend.
    this.pending = new Map(mapping);
    await this.registerPending({ firstAttempt: true });
    this.connect(url);
    this.registrar = setInterval(() => {
      if (this.pending.size === 0) return;
      this.registerPending({ firstAttempt: false }).catch((error) =>
        logEvent('error', 'hardware.register_failed', { error: error.message }));
    }, 15000);
    this.registrar.unref?.();
  }

  async registerPending({ firstAttempt }) {
    for (const [deviceId, farmCode] of this.pending) {
      const farm = await Farm.findOne({ code: farmCode });
      if (!farm) {
        if (firstAttempt) {
          logEvent('error', 'hardware.unknown_farm', {
            deviceId, farmCode,
            hint: `No farm with code ${farmCode}. Seed the database or fix HARDWARE_DEVICES; retrying every 15 s.`
          });
        }
        continue;
      }
      await this.register(deviceId, farm);
      this.pending.delete(deviceId);
      if (!firstAttempt) logEvent('info', 'hardware.device_registered', { deviceId, farmCode });
    }
  }

  async register(deviceId, farm) {
    iotMvpService.hardwareRetry = (incident) => this.retryIncident(incident);
    const lastCommand = await PumpCommand.findOne({ farm: farm._id }).sort({ requestedAt: -1 });
    const state = {
      deviceId,
      farmId: farm._id,
      farmCode: farm.code,
      farmName: farm.name,
      online: false,
      lastSeenAt: null,
      lastStatus: null,
      relayOn: null,
      soil: null,
      temperature: null,
      airHumidity: null,
      activeCommandId: ['published', 'acknowledged'].includes(lastCommand?.status) ? lastCommand.commandId : null,
      // True only while a FarmGuard command waits for the relay ACK: avoids a DB query per pump/state message.
      awaitingAck: lastCommand?.status === 'published',
      evaluating: false
    };
    this.devices.set(deviceId, state);
    iotMvpService.externalStates.set(String(farm._id), this.snapshotState(state));
    return state;
  }

  connect(url) {
    const mapping = hardwareDevices();
    const prefix = hardwareConfig.topicPrefix();
    this.client = mqtt.connect(url, {
      clientId: `farmguard-hw-${randomUUID()}`,
      username: process.env.HARDWARE_MQTT_USERNAME || process.env.MQTT_USERNAME || undefined,
      password: process.env.HARDWARE_MQTT_PASSWORD || process.env.MQTT_PASSWORD || undefined,
      reconnectPeriod: 2000
    });
    const topics = [`${prefix}/+/telemetry`, `${prefix}/+/pump/state`, `${prefix}/+/status`];
    this.client.on('connect', () => {
      this.client.subscribe(topics, { qos: 0 }, (error) => {
        if (error) logEvent('error', 'hardware.mqtt_subscribe_failed', { error: error.message });
        else logEvent('info', 'hardware.mqtt_subscribed', { url: url.replace(/\/\/[^@]*@/, '//***@'), topics });
      });
    });
    this.client.on('error', (error) => logEvent('error', 'hardware.mqtt_connection_failed', { error: error.message }));
    this.client.on('message', (topic, payload) => {
      this.route(topic, payload).catch((error) =>
        logEvent('warn', 'hardware.message_rejected', { topic, error: error.message }));
    });

    this.watchdog = setInterval(() => this.checkHealth().catch((error) =>
      logEvent('error', 'hardware.watchdog_failed', { error: error.message })), 5000);
    this.watchdog.unref?.();
    logEvent('info', 'hardware.bridge_started', { devices: Object.fromEntries(mapping), prefix });
  }

  async stop() {
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.registrar) clearInterval(this.registrar);
    this.watchdog = null;
    this.registrar = null;
    if (this.client) await new Promise((resolve) => this.client.end(false, resolve));
    this.client = null;
  }

  isHardwareFarm(farmId) {
    return [...this.devices.values()].some((state) => String(state.farmId) === String(farmId));
  }

  snapshotState(state) {
    return {
      source: 'hardware',
      deviceId: state.deviceId,
      online: state.online,
      lastSeenAt: state.lastSeenAt,
      pumpPhysical: Boolean(state.relayOn),
      pumpCurrent: null, // the board has no current sensor
      pumpControllerOnline: state.online,
      pumpPowerAvailable: true,
      scenario: 'hardware',
      // Live readings, so the dashboard does not depend on Sensor documents existing.
      soilMoisture: state.soil,
      temperature: state.temperature,
      airHumidity: state.airHumidity
    };
  }

  publishSnapshot(state) {
    iotMvpService.externalStates.set(String(state.farmId), this.snapshotState(state));
    realtimeService.broadcast('snapshot-invalidated', { at: new Date().toISOString(), source: 'hardware' });
  }

  async route(topic, payload) {
    const prefix = hardwareConfig.topicPrefix();
    const match = new RegExp(`^${prefix}/([A-Za-z0-9_-]{1,40})/(telemetry|pump/state|status)$`).exec(topic);
    if (!match) return;
    const state = this.devices.get(match[1]);
    if (!state) return; // a device we were not configured to track
    if (payload.length > 1024) throw new Error('Payload exceeds 1 KiB');

    if (match[2] === 'telemetry') {
      await traceOperation('farmguard.hardware.telemetry', { 'farm.code': state.farmCode, 'device.id': state.deviceId },
        () => this.onTelemetry(state, parseFirmwareJson(payload)));
    } else if (match[2] === 'pump/state') {
      const value = payload.toString('utf8').trim().toUpperCase();
      if (value === 'ON' || value === 'OFF') await this.onRelay(state, value === 'ON', 'pump/state');
    } else {
      const status = payload.toString('utf8').trim().toLowerCase();
      if (status !== state.lastStatus) {
        state.lastStatus = status;
        logEvent('info', 'hardware.status', { farmCode: state.farmCode, deviceId: state.deviceId, status });
      }
    }
  }

  async onTelemetry(state, data) {
    const capturedAt = new Date(); // the ESP32 has no RTC: stamp on arrival
    const soil = reading(data.soil, 0, 100);
    const temperature = reading(data.temperature, -20, 80);
    const airHumidity = reading(data.humidity, 0, 100);
    const relayOn = typeof data.pump === 'boolean' ? data.pump : null;
    const farm = await Farm.findById(state.farmId);
    if (!farm) throw new Error('Farm no longer exists');

    // The firmware is the source of truth for AUTO/MANUAL (it boots in AUTO).
    const mode = data.mode === 'AUTO' ? 'auto' : data.mode === 'MANUAL' ? 'manual' : null;
    if (mode && farm.pump.mode !== mode) {
      await Farm.updateOne({ _id: farm._id }, { $set: { 'pump.mode': mode } });
      farm.pump.mode = mode;
      logEvent('info', 'hardware.mode_synced', { farmCode: farm.code, deviceId: state.deviceId, mode });
    }

    const messageId = `${state.deviceId}-${capturedAt.getTime()}`;
    const meta = (sensorType) => ({
      farmId: farm._id, farmCode: farm.code, deviceId: `${farm.code}-${state.deviceId}`, sensorType
    });
    const docs = [
      // FarmGuard's "humidity" series is soil moisture (what irrigation must change).
      soil !== null && { sensorType: 'humidity', value: soil, unit: 'percent' },
      temperature !== null && { sensorType: 'temperature', value: temperature, unit: 'celsius' },
      airHumidity !== null && { sensorType: 'air_humidity', value: airHumidity, unit: 'percent' },
      relayOn !== null && { sensorType: 'pump_relay', value: relayOn ? 1 : 0, unit: 'state' }
    ].filter(Boolean).map((item) => ({
      capturedAt, meta: meta(item.sensorType), value: item.value, unit: item.unit,
      messageId, correlationId: null, source: 'hardware', quality: 'good'
    }));
    if (docs.length === 0) throw new Error('No valid readings (sensor errors?)');
    await Telemetry.insertMany(docs, { ordered: false });

    const sensorTypes = docs.map((doc) => doc.meta.sensorType);
    try {
      await telemetryPipelineService.recordBatch({ farm, messageId, capturedAt, sensorTypes, source: 'hardware' });
    } catch (error) {
      logEvent('error', 'telemetry.event_write_failed', { farmCode: farm.code, messageId, error: error.message });
    }
    const snapshot = [['humidity', soil], ['temperature', temperature]].filter(([, value]) => value !== null);
    if (snapshot.length) {
      await Sensor.bulkWrite(snapshot.map(([type, value]) => ({
        updateOne: { filter: { farm: farm._id, type }, update: { $set: { lastValue: value, lastReadingAt: capturedAt, status: 'online' } } }
      })));
    }

    state.soil = soil ?? state.soil;
    state.temperature = temperature ?? state.temperature;
    state.airHumidity = airHumidity ?? state.airHumidity;
    state.lastSeenAt = capturedAt;
    if (!state.online) {
      state.online = true;
      logEvent('info', 'device.connection_restored', { farmCode: farm.code, deviceId: state.deviceId, source: 'hardware' });
      realtimeService.addEvent({ farm: farm.name, type: 'success', message: `ESP32 ${state.deviceId} is streaming live telemetry.` });
    }

    const tags = { farm: farm.code, device: state.deviceId, source: 'hardware' };
    metric('smartfarm.telemetry.received', docs.length, 'c', { ...tags, status: 'accepted' });
    if (soil !== null) metric('smartfarm.soil_moisture.percent', soil, 'g', tags);
    if (temperature !== null) metric('smartfarm.temperature.celsius', temperature, 'g', tags);
    if (airHumidity !== null) metric('smartfarm.air_humidity.percent', airHumidity, 'g', tags);
    if (temperature === null || airHumidity === null) metric('smartfarm.sensor.read_error', 1, 'c', { ...tags, sensor: 'dht22' });

    if (relayOn !== null) await this.onRelay(state, relayOn, 'telemetry');
    await this.evaluateOutcome(state, farm);
    this.publishSnapshot(state);
  }

  // Runs for every pump/state message (the firmware sends ~100/s), so the common path is in-memory only.
  async onRelay(state, on, origin) {
    const changed = state.relayOn !== on;
    state.relayOn = on;
    if (state.activeCommandId && state.awaitingAck) await this.maybeAcknowledge(state, on);
    if (!changed) return;

    const now = new Date();
    const farm = await Farm.findById(state.farmId);
    metric('smartfarm.pump.relay_on', on ? 1 : 0, 'g', { farm: state.farmCode, device: state.deviceId, source: 'hardware' });
    logEvent('info', on ? 'pump.relay.on' : 'pump.relay.off', { farmCode: state.farmCode, deviceId: state.deviceId, origin, soil: state.soil });
    await Promise.all([
      Farm.updateOne({ _id: state.farmId }, {
        $set: { 'pump.status': on ? 'on' : 'off', 'pump.startedAt': on ? now : null, 'pump.lastChangedAt': now }
      }),
      PumpLog.create({
        farm: state.farmId,
        action: on ? 'turned_on' : 'turned_off',
        trigger: state.activeCommandId ? 'system' : 'auto_humidity_low',
        mode: farm?.pump.mode || 'auto',
        humidityValue: state.soil ?? 0,
        threshold: hardwareConfig.dryThreshold(),
        runDurationMinutes: farm?.thresholds.pumpRunMinutes ?? 30,
        startedAt: on ? now : null,
        stoppedAt: on ? null : now,
        occurredAt: now
      }).catch((error) => logEvent('warn', 'hardware.pump_log_failed', { error: error.message }))
    ]);

    if (!on) await this.onRelayOff(state);
    if (on) {
      // A new activation while an incident is open restarts the recovery window.
      await Incident.updateOne({ farm: state.farmId, status: ACTIVE_INCIDENT }, { $set: { mitigatingAt: now } });
    }

    // The firmware runs AUTO irrigation locally. Record that activation as a command
    // so its physical outcome is verified exactly like a FarmGuard-issued one.
    if (on && !state.activeCommandId) {
      const commandId = `hw-${randomUUID()}`;
      const command = await PumpCommand.create({
        commandId,
        correlationId: `corr-${randomUUID()}`,
        idempotencyKey: `${state.farmCode}:${commandId}:ON`,
        farm: state.farmId,
        pumpId: `${state.farmCode}-${state.deviceId}-RELAY`,
        action: 'ON',
        status: 'acknowledged',
        requestedAt: now,
        publishedAt: now,
        acknowledgedAt: now,
        expiresAt: new Date(now.getTime() + hardwareConfig.ackTimeoutMs()),
        ruleEvidence: { humidityValue: state.soil, threshold: hardwareConfig.dryThreshold(), sampleCount: 1 },
        acknowledgement: { deviceId: state.deviceId }
      });
      state.activeCommandId = command.commandId;
      realtimeService.addEvent({
        farm: state.farmName, type: 'info', correlationId: command.correlationId,
        message: `ESP32 relay switched ON at soil ${state.soil}%. Waiting for soil moisture to rise.`
      });
    }
    this.publishSnapshot(state);
  }

  async onRelayOff(state) {
    if (!state.activeCommandId) return;
    const command = await PumpCommand.findOne({ commandId: state.activeCommandId });
    if (command?.status !== 'acknowledged' || command.action !== 'ON') return;
    if (await Incident.exists({ farm: state.farmId, status: ACTIVE_INCIDENT })) return; // keep it for recovery
    command.status = 'failed';
    command.lastError = 'Relay switched OFF before the outcome was verified (firmware safety cut-off or manual OFF).';
    await command.save();
    state.activeCommandId = null;
    logEvent('warn', 'pump.command.outcome_unverified', {
      farmCode: state.farmCode, commandId: command.commandId, correlationId: command.correlationId, source: 'hardware'
    });
  }

  async maybeAcknowledge(state, on) {
    const command = await PumpCommand.findOne({ commandId: state.activeCommandId, status: 'published' });
    if (!command) {
      state.awaitingAck = false;
      return;
    }
    if ((command.action === 'ON') !== on) return;
    state.awaitingAck = false;
    const acknowledgedAt = new Date();
    command.status = 'acknowledged';
    command.acknowledgedAt = acknowledgedAt;
    command.acknowledgement = { deviceId: state.deviceId };
    command.lastError = '';
    await command.save();
    metric('smartfarm.command.ack_latency_ms', acknowledgedAt - command.publishedAt, 'd', { farm: state.farmCode, source: 'hardware' });
    logEvent('info', 'pump.command.acknowledged', {
      farmCode: state.farmCode, commandId: command.commandId, correlationId: command.correlationId, source: 'hardware'
    });
    if (command.action === 'OFF') state.activeCommandId = null;
  }

  // Outcome assurance on real data: soil readings since the relay ACK, aggregated in MongoDB.
  async evaluateOutcome(state, farm) {
    if (state.evaluating) return;
    state.evaluating = true;
    try {
      const incident = await Incident.findOne({ farm: farm._id, status: ACTIVE_INCIDENT });
      const command = state.activeCommandId
        ? await PumpCommand.findOne({ commandId: state.activeCommandId })
        : null;

      if (command?.status === 'acknowledged' && command.action === 'ON' && state.relayOn) {
        const since = incident?.mitigatingAt || command.acknowledgedAt;
        const [soil] = await Telemetry.aggregate([
          { $match: { 'meta.farmId': farm._id, 'meta.sensorType': 'humidity', capturedAt: { $gte: since } } },
          { $sort: { capturedAt: 1 } },
          { $group: { _id: null, samples: { $sum: 1 }, values: { $push: '$value' } } },
          { $project: {
            samples: 1,
            start: { $avg: { $slice: ['$values', 3] } },
            end: { $avg: { $slice: ['$values', -3] } }
          } }
        ]);
        const rise = soil && soil.samples >= 4 ? soil.end - soil.start : 0;

        if (rise >= hardwareConfig.minMoistureRise()) {
          command.status = 'effect_confirmed';
          command.effectConfirmedAt = new Date();
          await command.save();
          state.activeCommandId = null;
          metric('smartfarm.command.effect_confirmed', 1, 'c', { farm: farm.code, source: 'hardware' });
          logEvent('info', 'pump.command.effect_confirmed', {
            farmCode: farm.code, commandId: command.commandId, correlationId: command.correlationId,
            moistureRise: round(rise), source: 'hardware'
          });
          if (incident) await this.resolveIncident(state, farm, incident, command, soil, rise);
        } else if (!incident && Date.now() - command.acknowledgedAt.getTime() >= hardwareConfig.effectWindowMs() && soil?.samples >= 4) {
          await this.openSilentFailure(state, farm, command, soil, rise);
        }
      }

      const open = await Incident.findOne({ farm: farm._id, status: ACTIVE_INCIDENT }).select('type').lean();
      const tags = { farm: farm.code, source: 'hardware' };
      metric('smartfarm.irrigation.outcome_missing', open?.type === 'pump_no_effect' ? 1 : 0, 'g', tags);
      metric('smartfarm.incident.open', open ? 1 : 0, 'g', tags);
    } finally {
      state.evaluating = false;
    }
  }

  async openSilentFailure(state, farm, command, soil, rise) {
    // The command stays "acknowledged": the same relay activation keeps being watched,
    // so if water starts flowing (hose fixed, tank refilled) the incident resolves with proof.
    command.lastError = `Relay ON for ${Math.round(hardwareConfig.effectWindowMs() / 1000)} s but soil moisture rose only ${round(rise)} points.`;
    await command.save();
    let incident;
    try {
      incident = await Incident.create({
        incidentId: `inc-${randomUUID()}`,
        correlationId: command.correlationId,
        farm: farm._id,
        command: command._id,
        type: 'pump_no_effect',
        status: 'open',
        impactStartedAt: command.acknowledgedAt,
        summary: `ESP32 relay at ${farm.name} is ON but soil moisture is not rising (pump, water supply or hose fault).`,
        recoveryEvidence: { ackReceived: true, pumpCurrentAmp: 0, moistureBefore: round(soil.start) }
      });
    } catch (error) {
      if (error.code === 11000) return; // another evaluation opened it first
      throw error;
    }
    iotMvpService.recordIncidentOpened(farm, incident);
    realtimeService.addEvent({
      farm: farm.name, type: 'error', correlationId: incident.correlationId,
      message: `SILENT FAILURE (real hardware): relay ON, soil moisture ${round(soil.start)}% -> ${round(soil.end)}%.`
    });
    logEvent('error', 'irrigation.outcome_missing', {
      farmCode: farm.code, deviceId: state.deviceId, incidentId: incident.incidentId, commandId: command.commandId,
      correlationId: command.correlationId, moistureBefore: round(soil.start), moistureAfter: round(soil.end),
      moistureRise: round(rise), source: 'hardware'
    });
  }

  async resolveIncident(state, farm, incident, command, soil, rise) {
    incident.status = 'resolved';
    incident.mitigatingAt ||= command.acknowledgedAt;
    incident.resolvedAt = new Date();
    incident.resolution = 'Real soil-moisture readings rose while the relay was ON: water reached the soil.';
    incident.recoveryEvidence = {
      ackReceived: true,
      pumpCurrentAmp: 0,
      moistureBefore: round(soil.start),
      moistureAfter: round(soil.end)
    };
    await incident.save();
    metric('smartfarm.irrigation.outcome_missing', 0, 'g', { farm: farm.code, source: 'hardware' });
    iotMvpService.recordIncidentResolved(farm, incident);
    realtimeService.addEvent({
      farm: farm.name, type: 'success', correlationId: incident.correlationId,
      message: `RECOVERED (real hardware): soil moisture rose ${round(rise)} points while the relay was ON.`
    });
    logEvent('info', 'incident.resolved', {
      farmCode: farm.code, incidentId: incident.incidentId, correlationId: incident.correlationId,
      moistureBefore: round(soil.start), moistureAfter: round(soil.end), source: 'hardware'
    });
  }

  async checkHealth() {
    const now = Date.now();
    for (const state of this.devices.values()) {
      const ageMs = state.lastSeenAt ? now - state.lastSeenAt.getTime() : Infinity;
      const tags = { farm: state.farmCode, device: state.deviceId, source: 'hardware' };
      if (state.online && ageMs > hardwareConfig.staleMs()) {
        state.online = false;
        logEvent('error', 'device.offline', {
          farmCode: state.farmCode, deviceId: state.deviceId, lastSeenAt: state.lastSeenAt, source: 'hardware'
        });
        realtimeService.addEvent({ farm: state.farmName, type: 'error', message: `ESP32 ${state.deviceId} stopped sending telemetry.` });
        this.publishSnapshot(state);
      }
      metric('smartfarm.device.online', state.online ? 1 : 0, 'g', tags);
      if (Number.isFinite(ageMs)) metric('smartfarm.device.last_seen_seconds', round(ageMs / 1000), 'g', tags);

      // ACK deadline for commands FarmGuard published to the device.
      if (state.activeCommandId) {
        const command = await PumpCommand.findOne({ commandId: state.activeCommandId, status: 'published' });
        if (command && now >= command.expiresAt.getTime()) await this.timeoutCommand(state, command);
      }
    }
  }

  async timeoutCommand(state, command) {
    state.awaitingAck = false;
    command.status = 'ack_timeout';
    command.lastError = `ESP32 ${state.deviceId} did not switch the relay ${command.action} before the deadline.`;
    await command.save();
    state.activeCommandId = null;
    const farm = await Farm.findById(state.farmId);
    metric('smartfarm.command.timeout', 1, 'c', { farm: state.farmCode, source: 'hardware' });
    logEvent('error', 'pump.command.ack_timeout', {
      farmCode: state.farmCode, deviceId: state.deviceId, commandId: command.commandId, correlationId: command.correlationId, source: 'hardware'
    });
    if (command.action !== 'ON' || await Incident.exists({ farm: state.farmId, status: ACTIVE_INCIDENT })) return;
    try {
      const incident = await Incident.create({
        incidentId: `inc-${randomUUID()}`,
        correlationId: command.correlationId,
        farm: state.farmId,
        command: command._id,
        type: 'pump_ack_timeout',
        status: 'open',
        impactStartedAt: command.publishedAt,
        summary: `ESP32 ${state.deviceId} at ${state.farmName} did not acknowledge the irrigation command.`,
        recoveryEvidence: { moistureBefore: state.soil }
      });
      iotMvpService.recordIncidentOpened(farm, incident);
    } catch (error) {
      if (error.code !== 11000) throw error;
    }
  }

  // ---------------------------------------------------------------- commands to the device

  async sendCommand(farmCode, action, { correlationId, retryCount = 0 } = {}) {
    const state = [...this.devices.values()].find((item) => item.farmCode === farmCode);
    if (!state) throw new AppError(`${farmCode} is not connected to real hardware`, 404);
    if (!this.client?.connected) throw new AppError('Hardware MQTT broker is not connected', 503);
    const prefix = hardwareConfig.topicPrefix();

    if (action === 'AUTO' || action === 'MANUAL') {
      await new Promise((resolve, reject) => this.client.publish(
        `${prefix}/${state.deviceId}/mode/command`, action, { qos: 1 }, (error) => (error ? reject(error) : resolve())
      ));
      await Farm.updateOne({ _id: state.farmId }, { $set: { 'pump.mode': action === 'AUTO' ? 'auto' : 'manual' } });
      logEvent('info', 'hardware.mode_command', { farmCode, deviceId: state.deviceId, mode: action });
      this.publishSnapshot(state);
      return { farmCode, deviceId: state.deviceId, mode: action };
    }
    if (action !== 'ON' && action !== 'OFF') throw new AppError('action must be ON, OFF, AUTO or MANUAL', 400);
    if (!state.online) throw new AppError(`ESP32 ${state.deviceId} is offline`, 409);
    // Retries of an incident are allowed in AUTO; a manual toggle would be overridden by the firmware AUTO loop.
    if (!correlationId) {
      const farm = await Farm.findById(state.farmId).select('pump.mode').lean();
      if (farm?.pump?.mode !== 'manual') throw new AppError('Switch the ESP32 to MANUAL mode before toggling the pump', 409);
    }

    const now = new Date();
    // The operator is replacing the pending activation: close it so it is not left "acknowledged" forever.
    if (state.activeCommandId) {
      const previous = await PumpCommand.findOne({ commandId: state.activeCommandId, status: { $in: ['published', 'acknowledged'] } });
      if (previous && !(await Incident.exists({ farm: state.farmId, status: ACTIVE_INCIDENT }))) {
        previous.status = 'failed';
        previous.lastError = `Superseded by operator command ${action} before the outcome was verified.`;
        await previous.save();
      }
    }
    const commandId = `cmd-${randomUUID()}`;
    const command = await PumpCommand.create({
      commandId,
      correlationId: correlationId || `corr-${randomUUID()}`,
      idempotencyKey: `${farmCode}:${commandId}:${action}`,
      farm: state.farmId,
      pumpId: `${farmCode}-${state.deviceId}-RELAY`,
      action,
      status: 'published',
      requestedAt: now,
      publishedAt: now,
      expiresAt: new Date(now.getTime() + hardwareConfig.ackTimeoutMs()),
      retryCount,
      ruleEvidence: { humidityValue: state.soil, threshold: hardwareConfig.dryThreshold(), sampleCount: 1 }
    });
    state.activeCommandId = commandId;
    state.awaitingAck = true;
    await new Promise((resolve, reject) => this.client.publish(
      `${prefix}/${state.deviceId}/pump/command`, action, { qos: 1 }, (error) => (error ? reject(error) : resolve())
    ));
    logEvent('info', 'pump.command.published', {
      farmCode, deviceId: state.deviceId, commandId, correlationId: command.correlationId, action, source: 'hardware'
    });
    // The relay may already be in the requested state; firmware re-publishes it continuously.
    if (state.relayOn === (action === 'ON')) await this.maybeAcknowledge(state, state.relayOn);
    return { farmCode, deviceId: state.deviceId, commandId, correlationId: command.correlationId, action };
  }

  async retryIncident(incident) {
    const state = [...this.devices.values()].find((item) => String(item.farmId) === String(incident.farm._id));
    if (!state?.online) throw new AppError('The ESP32 is offline: restore power or Wi-Fi first', 409);
    const result = await this.sendCommand(state.farmCode, 'ON', {
      correlationId: incident.correlationId, retryCount: (incident.command?.retryCount ?? 0) + 1
    });
    const command = await PumpCommand.findOne({ commandId: result.commandId });
    incident.originalCommand ||= incident.command?._id;
    incident.command = command._id;
    incident.status = 'mitigating';
    incident.mitigatingAt = new Date();
    incident.recoveryEvidence = { ackReceived: false, pumpCurrentAmp: 0, moistureBefore: state.soil, moistureAfter: null };
    await incident.save();
    logEvent('info', 'pump.command.repair_issued', {
      farmCode: state.farmCode, incidentId: incident.incidentId, commandId: result.commandId,
      correlationId: incident.correlationId, source: 'hardware'
    });
    return { incidentId: incident.incidentId, commandId: result.commandId, status: incident.status };
  }

  status() {
    return [...this.devices.values()].map((state) => ({
      deviceId: state.deviceId,
      farmCode: state.farmCode,
      online: state.online,
      lastSeenAt: state.lastSeenAt,
      relay: state.relayOn === null ? 'unknown' : state.relayOn ? 'ON' : 'OFF',
      soilMoisture: state.soil,
      temperature: state.temperature,
      airHumidity: state.airHumidity,
      brokerConnected: Boolean(this.client?.connected)
    }));
  }
}

export const hardwareBridgeService = new HardwareBridgeService();
