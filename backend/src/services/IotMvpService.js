import { randomUUID } from 'node:crypto';
import {
  Farm,
  Incident,
  PumpCommand,
  PumpLog,
  Sensor,
  Telemetry
} from '../models/index.js';
import { hardwareFarmCodes } from '../config/hardware.js';
import { AppError } from '../utils/AppError.js';
import { ddEvent, logEvent, metric, traceOperation } from '../utils/observability.js';
import { realtimeService } from './RealtimeService.js';
import { telemetryPipelineService } from './TelemetryPipelineService.js';

const ACTIVE_COMMAND_STATUSES = ['pending', 'published', 'acknowledged'];
const ACK_TIMEOUT_MS = Number(process.env.SIMULATOR_ACK_TIMEOUT_MS || 5000);
const EFFECT_TIMEOUT_MS = Number(process.env.SIMULATOR_EFFECT_TIMEOUT_MS || 5000);
const TICK_MS = Number(process.env.SIMULATOR_TICK_MS || 2000);
const HISTORY_WINDOW_MINUTES = Number(process.env.TELEMETRY_HISTORY_WINDOW_MINUTES || 15);
const BASELINE_MANUAL_DETECTION_HOURS = Number(process.env.BASELINE_MANUAL_DETECTION_HOURS || 12);
const HISTORY_POINTS_PER_SERIES = Number(process.env.TELEMETRY_HISTORY_POINTS_PER_SERIES || 30);

function round(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// A clamp-on current transformer is never perfectly flat: a running pump draws
// ~1.8 A with +/-8% ripple and an idle line shows a small noise floor (< 0.05 A).
function pumpCurrentReading(running) {
  return running ? round(1.8 + (Math.random() - 0.5) * 0.3, 2) : round(Math.random() * 0.04, 2);
}

function secondsBetween(start, end) {
  return start && end ? round((end.getTime() - start.getTime()) / 1000, 1) : null;
}

function displayLocation(farm) {
  return [farm.location?.address, farm.location?.city].filter(Boolean).join(', ');
}

class IotMvpService {
  constructor() {
    this.states = new Map();
    // Farms fed by real ESP32 hardware (filled by HardwareBridgeService), keyed by farm id.
    this.externalStates = new Map();
    this.hardwareRetry = null;
    this.timer = null;
    this.ticking = false;
  }

  async start() {
    if (this.timer || process.env.SIMULATOR_ENABLED === 'false') return;

    const hardwareFarms = hardwareFarmCodes();
    const farms = (await Farm.find({ status: 'active' })).filter((farm) => !hardwareFarms.has(farm.code));
    if (farms.length === 0) {
      logEvent('warn', 'simulator.no_farms', { message: 'Run npm run seed before starting the simulator.' });
      return;
    }

    const farmIds = farms.map((farm) => farm._id);
    const [sensors, activeIncidents, activeCommands] = await Promise.all([
      Sensor.find({ farm: { $in: farmIds } }),
      Incident.find({ farm: { $in: farmIds }, status: { $in: ['open', 'mitigating'] } }),
      PumpCommand.find({
        farm: { $in: farmIds },
        status: { $in: [...ACTIVE_COMMAND_STATUSES, 'ack_timeout'] }
      }).sort({ requestedAt: -1 })
    ]);
    for (const farm of farms) {
      const farmSensors = sensors.filter((sensor) => sensor.farm.equals(farm._id));
      const activeIncident = activeIncidents.find((incident) => incident.farm.equals(farm._id));
      const activeCommand = activeCommands.find((command) => command.farm.equals(farm._id));
      const valueFor = (type, fallback) => farmSensors.find((sensor) => sensor.type === type)?.lastValue ?? fallback;
      this.states.set(String(farm._id), {
        temperature: valueFor('temperature', 28),
        humidity: valueFor('humidity', 60),
        ph: valueFor('soil_ph', 6.5),
        pumpPhysical: farm.pump.status === 'on',
        pumpControllerOnline: activeIncident?.type !== 'pump_ack_timeout',
        pumpPowerAvailable: activeIncident?.type !== 'pump_no_effect' || farm.pump.status === 'on',
        dropAck: activeIncident?.type === 'pump_ack_timeout',
        scenario: activeIncident?.type || 'normal',
        currentCommandId: activeCommand?.commandId || null,
        recoveryIncidentId: activeIncident?.incidentId || null,
        recoveryBaseline: activeIncident?.recoveryEvidence?.moistureBefore ?? null
      });
    }

    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.timer.unref?.();
    logEvent('info', 'simulator.started', { farmCount: farms.length, tickMs: TICK_MS });
    await this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;

    try {
      const farms = await Farm.find({ _id: { $in: [...this.states.keys()] } });
      for (const farm of farms) {
        await traceOperation('farmguard.simulator.tick', { 'farm.code': farm.code }, () => this.processFarm(farm));
      }
      realtimeService.broadcast('snapshot-invalidated', { at: new Date().toISOString() });
    } catch (error) {
      logEvent('error', 'simulator.tick_failed', { error: error.message });
    } finally {
      this.ticking = false;
    }
  }

  async processFarm(farm) {
    const farmId = String(farm._id);
    const state = this.states.get(farmId);
    if (!state) return;

    state.temperature = round(state.temperature + (Math.random() - 0.5) * 0.3);
    state.ph = round(Math.max(5, Math.min(8, state.ph + (Math.random() - 0.5) * 0.04)), 2);
    state.humidity = round(
      Math.max(20, Math.min(90, state.humidity + (state.pumpPhysical ? 1.4 : -0.35) + (Math.random() - 0.5) * 0.2))
    );

    state.pumpCurrent = pumpCurrentReading(state.pumpPhysical);
    const capturedAt = new Date();
    const messageId = `msg-${randomUUID()}`;
    const command = state.currentCommandId
      ? await PumpCommand.findOne({ commandId: state.currentCommandId })
      : null;

    await Telemetry.insertMany([
      this.telemetryDocument(farm, 'temperature', state.temperature, 'celsius', messageId, capturedAt, command),
      this.telemetryDocument(farm, 'humidity', state.humidity, 'percent', messageId, capturedAt, command),
      this.telemetryDocument(farm, 'soil_ph', state.ph, 'ph', messageId, capturedAt, command),
      this.telemetryDocument(
        farm,
        'pump_current',
        state.pumpCurrent,
        'ampere',
        messageId,
        capturedAt,
        command
      )
    ], { ordered: false });
    try {
      await telemetryPipelineService.recordBatch({
        farm, messageId, capturedAt,
        sensorTypes: ['temperature', 'humidity', 'soil_ph', 'pump_current'], source: 'simulator'
      });
    } catch (error) {
      logEvent('error', 'telemetry.event_write_failed', { farmCode: farm.code, messageId, error: error.message });
    }

    await Sensor.bulkWrite(
      [
        ['temperature', state.temperature],
        ['humidity', state.humidity],
        ['soil_ph', state.ph]
      ].map(([type, value]) => ({
        updateOne: {
          filter: { farm: farm._id, type },
          update: { $set: { lastValue: value, lastReadingAt: capturedAt, status: 'online' } }
        }
      }))
    );

    metric('smartfarm.telemetry.received', 4, 'c', { farm: farm.code, status: 'accepted' });
    metric('smartfarm.soil_moisture.percent', state.humidity, 'g', { farm: farm.code });
    metric('smartfarm.pump.current_amp', state.pumpCurrent, 'g', { farm: farm.code });

    if (command?.status === 'published') {
      if (state.pumpControllerOnline && !state.dropAck) await this.acknowledgeCommand(farm, state, command);
      else if (Date.now() >= command.expiresAt.getTime()) await this.timeoutCommand(farm, state, command);
    }

    await this.maybeConfirmCommandEffect(farm, command);
    await this.maybeDetectSilentFailure(farm, state, command);
    await this.maybeConfirmRecovery(farm, state);
    metric('smartfarm.irrigation.outcome_missing',
      state.scenario === 'pump_no_effect' && state.recoveryIncidentId ? 1 : 0,
      'g', { farm: farm.code });
    // Emit every tick so Datadog always has a value (a one-off gauge looks like "no data").
    metric('smartfarm.incident.open', state.recoveryIncidentId ? 1 : 0, 'g', { farm: farm.code });
    await this.maybeCreateIrrigationCommand(farm, state);
  }

  telemetryDocument(farm, sensorType, value, unit, messageId, capturedAt, command) {
    return {
      capturedAt,
      meta: {
        farmId: farm._id,
        farmCode: farm.code,
        deviceId: `${farm.code}-${sensorType.toUpperCase().replace('_', '-')}`,
        sensorType
      },
      value,
      unit,
      messageId,
      correlationId: command?.correlationId || null,
      source: 'simulator',
      quality: 'good'
    };
  }

  async maybeCreateIrrigationCommand(farm, state) {
    if (
      farm.pump.mode !== 'auto' ||
      state.pumpPhysical ||
      state.recoveryIncidentId ||
      state.humidity >= farm.thresholds.humidityMin
    ) return;

    const activeCommand = await PumpCommand.exists({
      farm: farm._id,
      status: { $in: ACTIVE_COMMAND_STATUSES }
    });
    if (activeCommand) return;

    const correlationId = `corr-${randomUUID()}`;
    const commandId = `cmd-${randomUUID()}`;
    const now = new Date();
    const command = await PumpCommand.create({
      commandId,
      correlationId,
      idempotencyKey: `${farm.code}:${commandId}:ON`,
      farm: farm._id,
      pumpId: `${farm.code}-PUMP-01`,
      action: 'ON',
      status: 'published',
      requestedAt: now,
      publishedAt: now,
      expiresAt: new Date(now.getTime() + ACK_TIMEOUT_MS),
      ruleEvidence: {
        humidityValue: state.humidity,
        threshold: farm.thresholds.humidityMin,
        sampleCount: 3
      }
    });

    state.currentCommandId = command.commandId;
    realtimeService.addEvent({
      farm: farm.name,
      message: `Soil moisture ${state.humidity}% is below ${farm.thresholds.humidityMin}%. Pump command published.`,
      type: 'warning',
      correlationId
    });
    logEvent('info', 'pump.command.published', {
      farmCode: farm.code,
      commandId,
      correlationId,
      humidity: state.humidity
    });
  }

  async acknowledgeCommand(farm, state, command) {
    const acknowledgedAt = new Date();
    state.pumpPhysical = command.action === 'ON' && state.pumpPowerAvailable;

    command.status = 'acknowledged';
    command.acknowledgedAt = acknowledgedAt;
    command.effectConfirmedAt = null;
    command.acknowledgement = {
      deviceId: `${farm.code}-PUMP-01`,
      pumpCurrentAmp: 0
    };
    command.lastError = '';
    await command.save();

    if (state.pumpPhysical) await Promise.all([
      Farm.updateOne(
        { _id: farm._id },
        {
          $set: {
            'pump.status': state.pumpPhysical ? 'on' : 'off',
            'pump.startedAt': state.pumpPhysical ? acknowledgedAt : null,
            'pump.lastChangedAt': acknowledgedAt
          }
        }
      ),
      PumpLog.create({
        farm: farm._id,
        action: state.pumpPhysical ? 'turned_on' : 'turned_off',
        trigger: 'system',
        mode: farm.pump.mode,
        humidityValue: state.humidity,
        threshold: farm.thresholds.humidityMin,
        runDurationMinutes: farm.thresholds.pumpRunMinutes,
        startedAt: state.pumpPhysical ? acknowledgedAt : null,
        stoppedAt: state.pumpPhysical ? null : acknowledgedAt,
        occurredAt: acknowledgedAt
      })
    ]);

    realtimeService.addEvent({
      farm: farm.name,
      message: 'Device ACK received. Waiting for an independent pump-current reading.',
      type: 'info',
      correlationId: command.correlationId
    });
    metric('smartfarm.command.ack_latency_ms', acknowledgedAt - command.publishedAt, 'd', { farm: farm.code });
    logEvent('info', 'pump.command.acknowledged', {
      farmCode: farm.code,
      commandId: command.commandId,
      correlationId: command.correlationId
    });
  }

  async maybeConfirmCommandEffect(farm, command) {
    if (command?.status !== 'acknowledged') return;
    const reading = await Telemetry.findOne({
      'meta.farmId': farm._id,
      'meta.sensorType': 'pump_current',
      capturedAt: { $gte: command.acknowledgedAt },
      value: { $gt: 0.1 }
    }).sort({ capturedAt: 1 }).lean();
    if (!reading) return;
    command.status = 'effect_confirmed';
    command.effectConfirmedAt = reading.capturedAt;
    command.acknowledgement.pumpCurrentAmp = reading.value;
    await command.save();
    metric('smartfarm.command.effect_confirmed', 1, 'c', { farm: farm.code });
    logEvent('info', 'pump.command.effect_confirmed', {
      farmCode: farm.code,
      commandId: command.commandId,
      correlationId: command.correlationId,
      pumpCurrentAmp: reading.value,
      measuredAt: reading.capturedAt
    });
  }

  async timeoutCommand(farm, state, command) {
    if (command.status !== 'published') return;
    command.status = 'ack_timeout';
    command.lastError = 'Pump controller did not acknowledge before the deadline.';
    await command.save();

    const existing = await Incident.findOne({ command: command._id, status: { $ne: 'resolved' } });
    if (!existing) {
      const incident = await Incident.create({
        incidentId: `inc-${randomUUID()}`,
        correlationId: command.correlationId,
        farm: farm._id,
        command: command._id,
        type: 'pump_ack_timeout',
        status: 'open',
        impactStartedAt: command.publishedAt,
        summary: `Pump controller at ${farm.name} did not acknowledge the irrigation command.`,
        recoveryEvidence: { moistureBefore: state.humidity }
      });
      this.recordIncidentOpened(farm, incident);
      state.recoveryIncidentId = incident.incidentId;
      state.recoveryBaseline = state.humidity;
    }

    realtimeService.addEvent({
      farm: farm.name,
      message: 'INCIDENT: Pump command ACK timed out while soil moisture continues to fall.',
      type: 'error',
      correlationId: command.correlationId
    });
    metric('smartfarm.command.timeout', 1, 'c', { farm: farm.code });
    metric('smartfarm.incident.open', 1, 'g', { farm: farm.code });
    logEvent('error', 'pump.command.ack_timeout', {
      farmCode: farm.code,
      deviceId: `${farm.code}-PUMP-01`,
      commandId: command.commandId,
      correlationId: command.correlationId,
      durationMs: ACK_TIMEOUT_MS
    });
  }

  async maybeDetectSilentFailure(farm, state, command) {
    if (command?.status !== 'acknowledged' || state.recoveryIncidentId) return;
    if (Date.now() - command.acknowledgedAt.getTime() < EFFECT_TIMEOUT_MS) return;

    const readings = await Telemetry.aggregate([
      { $match: {
        'meta.farmId': farm._id,
        'meta.sensorType': { $in: ['humidity', 'pump_current'] },
        capturedAt: { $gte: command.acknowledgedAt, $lte: new Date() }
      } },
      { $sort: { capturedAt: 1 } },
      { $group: {
        _id: '$meta.sensorType',
        samples: { $sum: 1 },
        firstValue: { $first: '$value' },
        lastValue: { $last: '$value' },
        maximum: { $max: '$value' }
      } }
    ]);
    const moisture = readings.find((item) => item._id === 'humidity');
    const current = readings.find((item) => item._id === 'pump_current');
    if (!moisture || !current || moisture.samples < 2 || current.samples < 2) return;
    if (current.maximum > 0.1 || moisture.lastValue >= moisture.firstValue) return;

    command.status = 'failed';
    command.lastError = 'Controller ACK arrived, but telemetry shows no pump current and falling soil moisture.';
    await command.save();
    const incident = await Incident.create({
      incidentId: 'inc-' + randomUUID(),
      correlationId: command.correlationId,
      farm: farm._id,
      command: command._id,
      type: 'pump_no_effect',
      status: 'open',
      impactStartedAt: command.acknowledgedAt,
      summary: 'Pump at ' + farm.name + ' acknowledged the command but did not irrigate.',
      recoveryEvidence: { ackReceived: true, pumpCurrentAmp: 0, moistureBefore: moisture.lastValue }
    });
    this.recordIncidentOpened(farm, incident);
    state.recoveryIncidentId = incident.incidentId;
    state.recoveryBaseline = moisture.lastValue;
    realtimeService.addEvent({
      farm: farm.name,
      message: 'SILENT FAILURE: command ACK received, but pump current is zero and soil moisture is falling.',
      type: 'error',
      correlationId: command.correlationId
    });
    logEvent('error', 'irrigation.outcome_missing', {
      farmCode: farm.code,
      incidentId: incident.incidentId,
      commandId: command.commandId,
      correlationId: command.correlationId,
      pumpCurrentAmp: current.maximum,
      moistureBefore: moisture.firstValue,
      moistureAfter: moisture.lastValue
    });
  }

  recordIncidentOpened(farm, incident) {
    const tags = { farm: farm.code, incident_type: incident.type };
    const timeToDetect = secondsBetween(incident.impactStartedAt, incident.detectedAt);
    metric('smartfarm.incident.opened', 1, 'c', tags);
    if (timeToDetect !== null) metric('smartfarm.incident.time_to_detect_seconds', timeToDetect, 'd', tags);
    ddEvent(
      `FarmGuard incident opened: ${incident.type} on ${farm.code}`,
      `${incident.summary}\nincidentId: ${incident.incidentId}\ncorrelationId: ${incident.correlationId}\ntime to detect: ${timeToDetect}s`,
      'error',
      { ...tags, incident_id: incident.incidentId, correlation_id: incident.correlationId }
    );
  }

  recordIncidentResolved(farm, incident) {
    const tags = { farm: farm.code, incident_type: incident.type };
    const timeToResolve = secondsBetween(incident.detectedAt, incident.resolvedAt);
    const unirrigated = secondsBetween(incident.impactStartedAt || incident.detectedAt, incident.resolvedAt);
    metric('smartfarm.incident.resolved', 1, 'c', tags);
    if (timeToResolve !== null) metric('smartfarm.incident.time_to_resolve_seconds', timeToResolve, 'd', tags);
    if (unirrigated !== null) metric('smartfarm.incident.unirrigated_seconds', unirrigated, 'd', tags);
    ddEvent(
      `FarmGuard incident resolved: ${incident.type} on ${farm.code}`,
      `Recovery proven from MongoDB telemetry (moisture ${incident.recoveryEvidence?.moistureBefore}% -> ${incident.recoveryEvidence?.moistureAfter}%).\nincidentId: ${incident.incidentId}\ntime to resolve: ${timeToResolve}s`,
      'success',
      { ...tags, incident_id: incident.incidentId, correlation_id: incident.correlationId }
    );
  }

  // MTTD / MTTR and business impact, computed in MongoDB from the incidents collection.
  async getIncidentKpis({ hours = 24, baselineHours = BASELINE_MANUAL_DETECTION_HOURS } = {}) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const msBetween = (start, end) => ({
      $cond: [
        { $and: [{ $gt: [start, null] }, { $gt: [end, null] }] },
        { $dateDiff: { startDate: start, endDate: end, unit: 'millisecond' } },
        null
      ]
    });
    const [result] = await Incident.aggregate([
      { $match: { detectedAt: { $gte: since } } },
      { $set: {
        ttdMs: msBetween('$impactStartedAt', '$detectedAt'),
        ttrMs: msBetween('$detectedAt', '$resolvedAt'),
        impactMs: msBetween({ $ifNull: ['$impactStartedAt', '$detectedAt'] }, { $ifNull: ['$resolvedAt', '$$NOW'] })
      } },
      { $facet: {
        overall: [{ $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          mttdMs: { $avg: '$ttdMs' },
          mttrMs: { $avg: '$ttrMs' },
          maxTtrMs: { $max: '$ttrMs' },
          impactMs: { $sum: '$impactMs' }
        } }],
        byType: [
          { $group: { _id: '$type', count: { $sum: 1 }, mttdMs: { $avg: '$ttdMs' }, mttrMs: { $avg: '$ttrMs' } } },
          { $sort: { count: -1 } }
        ],
        byFarm: [
          { $group: { _id: '$farm', count: { $sum: 1 }, impactMs: { $sum: '$impactMs' } } },
          { $lookup: { from: 'farms', localField: '_id', foreignField: '_id', as: 'farm' } },
          { $project: { _id: 0, farmCode: { $first: '$farm.code' }, farmName: { $first: '$farm.name' }, count: 1, impactMs: 1 } },
          { $sort: { impactMs: -1 } }
        ]
      } }
    ]);

    const overall = result.overall[0] || { total: 0, open: 0, resolved: 0, mttdMs: null, mttrMs: null, maxTtrMs: null, impactMs: 0 };
    const toSeconds = (ms) => (ms == null ? null : round(ms / 1000, 1));
    const impactHours = overall.impactMs / 3_600_000;
    const baselineImpactHours = overall.total * baselineHours;
    return {
      windowHours: hours,
      since,
      incidents: { total: overall.total, open: overall.open, resolved: overall.resolved },
      mttdSeconds: toSeconds(overall.mttdMs),
      mttrSeconds: toSeconds(overall.mttrMs),
      maxTtrSeconds: toSeconds(overall.maxTtrMs),
      unirrigatedMinutes: round(overall.impactMs / 60_000, 1),
      businessImpact: {
        assumption: `Without outcome assurance a silent pump failure is noticed at the next field visit (~${baselineHours} h).`,
        baselineHoursPerIncident: baselineHours,
        baselineUnirrigatedHours: round(baselineImpactHours, 1),
        unirrigatedHoursAvoided: round(Math.max(0, baselineImpactHours - impactHours), 1)
      },
      byType: result.byType.map((item) => ({
        type: item._id, count: item.count, mttdSeconds: toSeconds(item.mttdMs), mttrSeconds: toSeconds(item.mttrMs)
      })),
      byFarm: result.byFarm.map(({ impactMs, ...item }) => ({ ...item, unirrigatedMinutes: round(impactMs / 60_000, 1) }))
    };
  }

  async getRecoveryProof(incident, command, to = new Date()) {
    const from = incident.mitigatingAt || incident.detectedAt;
    const readings = await Telemetry.aggregate([
      { $match: {
        'meta.farmId': incident.farm,
        'meta.sensorType': { $in: ['humidity', 'pump_current'] },
        capturedAt: { $gte: from, $lte: to }
      } },
      { $sort: { capturedAt: 1 } },
      { $group: {
        _id: '$meta.sensorType',
        samples: { $sum: 1 },
        firstValue: { $first: '$value' },
        lastValue: { $last: '$value' },
        maximum: { $max: '$value' }
      } }
    ]);
    const moisture = readings.find((item) => item._id === 'humidity');
    const current = readings.find((item) => item._id === 'pump_current');
    const moistureBefore = incident.recoveryEvidence.moistureBefore;
    const moistureAfter = moisture?.lastValue ?? null;
    const pumpCurrentAmp = current?.maximum ?? 0;
    const ackReceived = Boolean(command?.acknowledgedAt && command.acknowledgedAt >= from);
    return {
      ackReceived,
      pumpCurrentAmp,
      moistureBefore,
      moistureAfter,
      moistureSamples: moisture?.samples ?? 0,
      currentSamples: current?.samples ?? 0,
      moistureSlope: moisture ? round(moisture.lastValue - moisture.firstValue, 2) : null,
      recovered: ackReceived && pumpCurrentAmp > 0.1 &&
        moistureAfter !== null && moistureBefore !== null && moistureAfter >= moistureBefore + 1
    };
  }

  async maybeConfirmRecovery(farm, state) {
    if (!state.recoveryIncidentId || !state.pumpPhysical) return;

    const incident = await Incident.findOne({ incidentId: state.recoveryIncidentId, status: 'mitigating' });
    if (!incident) return;
    const command = await PumpCommand.findById(incident.command);
    const proof = await this.getRecoveryProof(incident, command);
    if (!proof.recovered) return;

    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    incident.resolution = 'Pump controller restored and the idempotent command retry was physically confirmed.';
    incident.recoveryEvidence = {
      ackReceived: proof.ackReceived,
      pumpCurrentAmp: proof.pumpCurrentAmp,
      moistureBefore: proof.moistureBefore,
      moistureAfter: proof.moistureAfter
    };
    await incident.save();

    realtimeService.addEvent({
      farm: farm.name,
      message: `RECOVERED: ACK and pump current confirmed; soil moisture rose from ${state.recoveryBaseline}% to ${state.humidity}%.`,
      type: 'success',
      correlationId: incident.correlationId
    });
    metric('smartfarm.incident.open', 0, 'g', { farm: farm.code });
    metric('smartfarm.irrigation.outcome_missing', 0, 'g', { farm: farm.code });
    this.recordIncidentResolved(farm, incident);
    logEvent('info', 'incident.resolved', {
      farmCode: farm.code,
      incidentId: incident.incidentId,
      correlationId: incident.correlationId,
      moistureBefore: state.recoveryBaseline,
      moistureAfter: state.humidity
    });
    state.recoveryIncidentId = null;
    state.recoveryBaseline = null;
  }

  async startAckTimeoutScenario(farmCode = 'FARM-002') {
    const farm = await Farm.findOne({ code: farmCode });
    if (!farm) throw new AppError(`Farm ${farmCode} not found`, 404);
    const state = this.states.get(String(farm._id));
    if (!state) throw this.notSimulatedError(farm);
    if (await Incident.exists({ farm: farm._id, status: { $in: ['open', 'mitigating'] } })) {
      throw new AppError('Resolve the active incident before starting another scenario', 409);
    }

    await PumpCommand.updateMany(
      { farm: farm._id, status: { $in: ACTIVE_COMMAND_STATUSES } },
      { $set: { status: 'failed', lastError: 'Superseded by a deterministic demo scenario.' } }
    );
    state.scenario = 'pump_ack_timeout';
    state.dropAck = true;
    state.pumpControllerOnline = false;
    state.pumpPowerAvailable = true;
    state.pumpPhysical = false;
    state.humidity = Math.min(state.humidity, farm.thresholds.humidityMin - 2);
    state.currentCommandId = null;
    await Farm.updateOne(
      { _id: farm._id },
      { $set: { 'pump.status': 'off', 'pump.lastChangedAt': new Date() } }
    );

    realtimeService.addEvent({
      farm: farm.name,
      message: 'FAULT INJECTED: Pump controller is offline; sensor telemetry remains online.',
      type: 'warning'
    });
    logEvent('warn', 'simulation.fault_injected', { farmCode, scenario: state.scenario });
    await this.tick();
    return { farmCode, scenario: state.scenario };
  }

  async startSilentFailureScenario(farmCode = 'FARM-002') {
    const farm = await Farm.findOne({ code: farmCode });
    if (!farm) throw new AppError('Farm not found', 404);
    const state = this.states.get(String(farm._id));
    if (!state) throw this.notSimulatedError(farm);
    if (await Incident.exists({ farm: farm._id, status: { $in: ['open', 'mitigating'] } })) {
      throw new AppError('Resolve the active incident before starting another scenario', 409);
    }

    await PumpCommand.updateMany(
      { farm: farm._id, status: { $in: ACTIVE_COMMAND_STATUSES } },
      { $set: { status: 'failed', lastError: 'Superseded by silent failure demo scenario.' } }
    );
    state.scenario = 'pump_no_effect';
    state.dropAck = false;
    state.pumpControllerOnline = true;
    state.pumpPowerAvailable = false;
    state.pumpPhysical = false;
    state.humidity = Math.min(state.humidity, farm.thresholds.humidityMin - 2);
    state.currentCommandId = null;
    await Farm.updateOne(
      { _id: farm._id },
      { $set: { 'pump.status': 'off', 'pump.lastChangedAt': new Date() } }
    );
    realtimeService.addEvent({
      farm: farm.name,
      message: 'FAULT INJECTED: controller ACK works, but pump power is disconnected.',
      type: 'warning'
    });
    logEvent('warn', 'simulation.silent_failure_injected', { farmCode, scenario: state.scenario });
    await this.tick();
    return { farmCode, scenario: state.scenario };
  }

  async restorePumpController(farmCode = 'FARM-002') {
    const { farm, state } = await this.getFarmState(farmCode);
    state.pumpControllerOnline = true;
    state.pumpPowerAvailable = true;
    state.dropAck = false;
    realtimeService.addEvent({
      farm: farm.name,
      message: 'Pump controller connection restored. It is ready for a safe retry.',
      type: 'info'
    });
    logEvent('info', 'device.connection_restored', { farmCode, deviceId: `${farm.code}-PUMP-01` });
    return { farmCode, pumpControllerOnline: true };
  }

  async retryIncident(incidentId) {
    const incident = await Incident.findOne({ incidentId }).populate('farm').populate('command');
    if (!incident) throw new AppError('Incident not found', 404);
    if (incident.status === 'resolved') throw new AppError('Incident is already resolved', 409);
    if (this.externalStates.has(String(incident.farm._id))) {
      if (!this.hardwareRetry) throw new AppError('Hardware bridge is not running', 503);
      return this.hardwareRetry(incident);
    }

    const state = this.states.get(String(incident.farm._id));
    if (!state?.pumpControllerOnline || !state.pumpPowerAvailable) {
      throw new AppError('Restore the controller and pump power before retrying', 409);
    }

    let command = incident.command;
    const now = new Date();
    const baselineReading = await Telemetry.findOne({
      'meta.farmId': incident.farm._id,
      'meta.sensorType': 'humidity',
      capturedAt: { $lte: now }
    }).sort({ capturedAt: -1 }).lean();
    const recoveryBaseline = baselineReading?.value ?? state.humidity;
    if (incident.type === 'pump_no_effect') {
      incident.originalCommand ||= command._id;
      const commandId = 'cmd-' + randomUUID();
      command = await PumpCommand.create({
        commandId,
        correlationId: incident.correlationId,
        idempotencyKey: incident.farm.code + ':' + commandId + ':ON',
        farm: incident.farm._id,
        pumpId: command.pumpId,
        action: 'ON',
        status: 'published',
        requestedAt: now,
        publishedAt: now,
        expiresAt: new Date(now.getTime() + ACK_TIMEOUT_MS),
        retryCount: command.retryCount + 1,
        ruleEvidence: command.ruleEvidence
      });
      incident.command = command._id;
    } else {
      command.status = 'published';
      command.acknowledgedAt = null;
      command.effectConfirmedAt = null;
      command.acknowledgement = {};
      command.retryCount += 1;
      command.publishedAt = now;
      command.expiresAt = new Date(now.getTime() + ACK_TIMEOUT_MS);
      command.lastError = '';
      await command.save();
    }

    incident.status = 'mitigating';
    incident.mitigatingAt = now;
    incident.recoveryEvidence = {
      ackReceived: false,
      pumpCurrentAmp: 0,
      moistureBefore: recoveryBaseline,
      moistureAfter: null
    };
    await incident.save();
    state.currentCommandId = command.commandId;
    state.recoveryIncidentId = incident.incidentId;
    state.recoveryBaseline = recoveryBaseline;

    realtimeService.addEvent({
      farm: incident.farm.name,
      message: incident.type === 'pump_no_effect'
        ? 'Power restored. Issuing a new command with a new idempotency key.'
        : `Retrying the same command safely (attempt ${command.retryCount}, idempotency key preserved).`,
      type: 'info',
      correlationId: incident.correlationId
    });
    logEvent('info', incident.type === 'pump_no_effect' ? 'pump.command.repair_issued' : 'pump.command.retried', {
      farmCode: incident.farm.code,
      incidentId,
      commandId: command.commandId,
      correlationId: command.correlationId,
      retryCount: command.retryCount
    });
    await this.tick();
    return { incidentId, commandId: command.commandId, status: incident.status };
  }

  async resetScenario(farmCode = 'FARM-002') {
    const { farm, state } = await this.getFarmState(farmCode);
    state.scenario = 'normal';
    state.dropAck = false;
    state.pumpControllerOnline = true;
    state.pumpPowerAvailable = true;
    realtimeService.addEvent({ farm: farm.name, message: 'Simulation scenario reset to normal.', type: 'info' });
    return { farmCode, scenario: state.scenario };
  }

  notSimulatedError(farm) {
    return this.externalStates.has(String(farm._id))
      ? new AppError(`${farm.code} is real hardware: create the fault physically (e.g. lift the pump out of the water)`, 409)
      : new AppError('Simulator is not running for this farm', 409);
  }

  async getFarmState(farmCode) {
    const farm = await Farm.findOne({ code: farmCode });
    if (!farm) throw new AppError(`Farm ${farmCode} not found`, 404);
    const state = this.states.get(String(farm._id));
    if (!state) throw this.notSimulatedError(farm);
    return { farm, state };
  }

  async getSnapshot() {
    const farms = await Farm.find({ status: 'active' }).sort('code');
    const farmIds = farms.map((farm) => farm._id);
    const historyFrom = new Date(Date.now() - HISTORY_WINDOW_MINUTES * 60 * 1000);
    const [sensors, commands, incidents, telemetry, commandCounts] = await Promise.all([
      Sensor.find({ farm: { $in: farmIds } }),
      PumpCommand.find({ farm: { $in: farmIds } }).sort({ requestedAt: -1 }).limit(30),
      Incident.find({ farm: { $in: farmIds } }).sort({ detectedAt: -1 }).limit(20),
      this.getRecentTelemetry(farmIds, historyFrom),
      PumpCommand.aggregate([
        { $match: { farm: { $in: farmIds } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const history = this.buildHistory(telemetry);
    const result = farms.map((farm) => {
      const farmId = String(farm._id);
      const state = this.states.get(farmId) || this.externalStates.get(farmId);
      const farmSensors = sensors.filter((sensor) => sensor.farm.equals(farm._id));
      const lastCommand = commands.find((command) => command.farm.equals(farm._id));
      const activeIncident = incidents.find(
        (incident) => incident.farm.equals(farm._id) && incident.status !== 'resolved'
      );
      const valueFor = (type) => farmSensors.find((sensor) => sensor.type === type)?.lastValue ?? null;

      return {
        id: farmId,
        code: farm.code,
        name: farm.name,
        crop: farm.cropType,
        location: displayLocation(farm),
        // "humidity" = SOIL moisture (drives irrigation). Air humidity (DHT22) is "airHumidity".
        temperature: state?.temperature ?? valueFor('temperature'),
        humidity: state?.soilMoisture ?? valueFor('humidity'),
        ph: valueFor('soil_ph'),
        online: state?.online ?? true,
        source: state?.source || 'simulator',
        deviceId: state?.deviceId || null,
        lastSeenAt: state?.lastSeenAt || null,
        airHumidity: state?.airHumidity ?? null,
        autoMode: farm.pump.mode === 'auto',
        pump: Boolean(state?.pumpPhysical),
        pumpTime: state?.pumpPhysical ? farm.thresholds.pumpRunMinutes * 60 : 0,
        pumpState: {
          desired: lastCommand?.action || 'OFF',
          commandStatus: lastCommand?.status || 'idle',
          acknowledged: Boolean(lastCommand?.acknowledgedAt),
          physical: state?.pumpPhysical ? 'ON' : 'OFF',
          currentAmp: state?.pumpCurrent ?? 0,
          controllerOnline: state?.pumpControllerOnline ?? false,
          powerAvailable: state?.pumpPowerAvailable ?? false
        },
        incident: activeIncident
          ? {
              id: activeIncident.incidentId,
              type: activeIncident.type,
              status: activeIncident.status,
              severity: activeIncident.severity,
              summary: activeIncident.summary,
              correlationId: activeIncident.correlationId
            }
          : null,
        scenario: state?.scenario || 'not-running',
        history: history[farmId] || []
      };
    });

    const commandCountByStatus = Object.fromEntries(commandCounts.map((item) => [item._id, item.count]));
    const totalCommands = Object.values(commandCountByStatus).reduce((sum, count) => sum + count, 0);
    const confirmedCommands = commandCountByStatus.effect_confirmed || 0;
    const openIncidentCount = incidents.filter((incident) => incident.status !== 'resolved').length;

    return {
      product: {
        name: 'FarmGuard',
        category: 'Irrigation Assurance',
        promise: 'Prove that every irrigation command produced a real physical outcome.'
      },
      assurance: {
        protectedFarms: farms.length,
        confirmedIrrigations: confirmedCommands,
        openIncidents: openIncidentCount,
        assuranceRate: totalCommands > 0 ? round((confirmedCommands / totalCommands) * 100, 1) : 100,
        historyWindowMinutes: HISTORY_WINDOW_MINUTES
      },
      telemetryPipeline: {
        mode: telemetryPipelineService.mode,
        mqttConnected: Boolean(telemetryPipelineService.mqttClient?.connected),
        anomalies: await telemetryPipelineService.recentAnomalies()
      },
      farms: result,
      events: realtimeService.recentEvents(),
      incidents: incidents.map((incident) => ({
        id: incident.incidentId,
        type: incident.type,
        farmId: String(incident.farm),
        status: incident.status,
        severity: incident.severity,
        summary: incident.summary,
        correlationId: incident.correlationId,
        detectedAt: incident.detectedAt,
        resolvedAt: incident.resolvedAt,
        recoveryEvidence: incident.recoveryEvidence
      }))
    };
  }

  async getRecentTelemetry(farmIds, from) {
    if (farmIds.length === 0) return [];

    return Telemetry.aggregate([
      {
        $match: {
          'meta.farmId': { $in: farmIds },
          capturedAt: { $gte: from }
        }
      },
      { $sort: { capturedAt: -1 } },
      {
        $group: {
          _id: {
            farmId: '$meta.farmId',
            sensorType: '$meta.sensorType'
          },
          samples: { $push: '$$ROOT' }
        }
      },
      { $project: { samples: { $slice: ['$samples', HISTORY_POINTS_PER_SERIES] } } },
      { $unwind: '$samples' },
      { $replaceRoot: { newRoot: '$samples' } }
    ]);
  }

  async getIncidentEvidence(incidentId) {
    const incident = await Incident.findOne({ incidentId });
    if (!incident) throw new AppError('Incident not found', 404);
    const commands = await PumpCommand.find({ correlationId: incident.correlationId }).sort({ requestedAt: 1 });
    const command = commands.find((item) => item._id.equals(incident.command)) || null;

    const from = new Date(incident.detectedAt.getTime() - 2 * 60 * 1000);
    const to = new Date((incident.resolvedAt || new Date()).getTime() + 2 * 60 * 1000);
    const detectedAt = incident.detectedAt;
    const recoveryStartedAt = incident.mitigatingAt || to;
    const [phases, timeline, proof] = await Promise.all([Telemetry.aggregate([
      {
        $match: {
          'meta.farmId': incident.farm,
          'meta.sensorType': 'humidity',
          capturedAt: { $gte: from, $lte: to }
        }
      },
      {
        $setWindowFields: {
          partitionBy: '$meta.farmId',
          sortBy: { capturedAt: 1 },
          output: {
            movingAverage: { $avg: '$value', window: { documents: [-2, 0] } }
          }
        }
      },
      {
        $set: {
          phase: {
            $switch: {
              branches: [
                { case: { $lt: ['$capturedAt', detectedAt] }, then: 'before' },
                { case: { $lt: ['$capturedAt', recoveryStartedAt] }, then: 'during' }
              ],
              default: 'after'
            }
          }
        }
      },
      { $sort: { capturedAt: 1 } },
      {
        $group: {
          _id: '$phase',
          samples: { $sum: 1 },
          average: { $avg: '$value' },
          minimum: { $min: '$value' },
          maximum: { $max: '$value' },
          firstValue: { $first: '$value' },
          lastValue: { $last: '$value' },
          latestMovingAverage: { $last: '$movingAverage' }
        }
      },
      {
        $project: {
          _id: 0,
          phase: '$_id',
          samples: 1,
          average: { $round: ['$average', 2] },
          minimum: 1,
          maximum: 1,
          slope: { $round: [{ $subtract: ['$lastValue', '$firstValue'] }, 2] },
          latestMovingAverage: { $round: ['$latestMovingAverage', 2] }
        }
      },
      { $sort: { phase: 1 } }
    ]), Telemetry.aggregate([
      { $match: {
        'meta.farmId': incident.farm,
        'meta.sensorType': { $in: ['humidity', 'pump_current'] },
        capturedAt: { $gte: from, $lte: to }
      } },
      { $sort: { capturedAt: 1 } },
      { $group: {
        _id: '$messageId',
        capturedAt: { $first: '$capturedAt' },
        moisture: { $max: { $cond: [{ $eq: ['$meta.sensorType', 'humidity'] }, '$value', null] } },
        pumpCurrent: { $max: { $cond: [{ $eq: ['$meta.sensorType', 'pump_current'] }, '$value', null] } }
      } },
      { $sort: { capturedAt: -1 } },
      { $limit: 90 },
      { $sort: { capturedAt: 1 } },
      { $project: { _id: 0, capturedAt: 1, moisture: 1, pumpCurrent: 1 } }
    ]), this.getRecoveryProof(incident, command, incident.resolvedAt || new Date())]);

    return {
      incidentId,
      type: incident.type,
      status: incident.status,
      window: { from, detectedAt, resolvedAt: incident.resolvedAt, to },
      phases,
      timeline,
      commands: commands.map((item) => ({
        commandId: item.commandId,
        status: item.status,
        idempotencyKey: item.idempotencyKey,
        publishedAt: item.publishedAt,
        acknowledgedAt: item.acknowledgedAt,
        effectConfirmedAt: item.effectConfirmedAt,
        retryCount: item.retryCount
      })),
      command: command ? {
        commandId: command.commandId,
        status: command.status,
        publishedAt: command.publishedAt,
        acknowledgedAt: command.acknowledgedAt,
        correlationId: command.correlationId,
        retryCount: command.retryCount
      } : null,
      recoveryEvidence: proof,
      recovered: incident.status === 'resolved' && proof.recovered
    };
  }

  buildHistory(telemetry) {
    const samples = new Map();
    for (const item of telemetry.reverse()) {
      const farmId = String(item.meta.farmId);
      const key = `${farmId}:${item.messageId}`;
      if (!samples.has(key)) {
        samples.set(key, {
          farmId,
          time: new Date(item.capturedAt).toLocaleTimeString('en-GB'),
          capturedAt: item.capturedAt
        });
      }
      const sample = samples.get(key);
      if (item.meta.sensorType === 'temperature') sample.temperature = item.value;
      if (item.meta.sensorType === 'humidity') sample.humidity = item.value;
      if (item.meta.sensorType === 'soil_ph') sample.ph = item.value;
      if (item.meta.sensorType === 'pump_current') sample.pumpCurrent = item.value;
      if (item.meta.sensorType === 'pump_relay') sample.pumpRelay = item.value;
      if (item.meta.sensorType === 'air_humidity') sample.airHumidity = item.value;
    }

    const history = {};
    for (const sample of samples.values()) {
      history[sample.farmId] ||= [];
      history[sample.farmId].push(sample);
      history[sample.farmId].sort((left, right) => new Date(left.capturedAt) - new Date(right.capturedAt));
      history[sample.farmId] = history[sample.farmId].slice(-HISTORY_POINTS_PER_SERIES);
    }
    return history;
  }
}

export const iotMvpService = new IotMvpService();
