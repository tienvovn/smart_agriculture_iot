import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import mqtt from 'mqtt';
import { Farm, Sensor, Telemetry, TelemetryAnomaly, TelemetryEvent } from '../models/index.js';
import { logEvent, metric } from '../utils/observability.js';
import { realtimeService } from './RealtimeService.js';

const WINDOW = 12;
const SENSOR_UNITS = { temperature: 'celsius', humidity: 'percent', soil_ph: 'ph', pump_current: 'ampere' };
const SENSOR_LIMITS = {
  temperature: [0, 60], humidity: [0, 100], soil_ph: [0, 14], pump_current: [0, 30]
};
const MIN_DELTA = { temperature: 2, humidity: 8, soil_ph: 0.5 };
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

class TelemetryPipelineService {
  constructor() {
    this.mode = 'direct';
    this.stream = null;
    this.mqttClient = null;
  }

  async start() {
    if (process.env.TELEMETRY_CHANGE_STREAM !== 'false') {
      try {
        const hello = await mongoose.connection.db.admin().command({ hello: 1 });
        if (hello.setName || hello.msg === 'isdbgrid') {
          this.stream = TelemetryEvent.watch([
            { $match: { operationType: { $in: ['insert', 'update'] } } }
          ], { fullDocument: 'updateLookup' });
          this.stream.on('change', (change) => {
            if (!change.fullDocument?.ready) return;
            this.processEvent(change.fullDocument).catch((error) =>
              logEvent('error', 'telemetry.change_stream_process_failed', { error: error.message }));
          });
          this.stream.on('error', (error) => {
            this.mode = 'direct';
            logEvent('error', 'telemetry.change_stream_failed', { error: error.message });
          });
          this.mode = 'change-stream';
        }
      } catch (error) {
        logEvent('warn', 'telemetry.change_stream_unavailable', { error: error.message });
      }
    }

    if (process.env.MQTT_URL) {
      const topic = process.env.MQTT_TOPIC || 'farmguard/+/telemetry';
      this.mqttClient = mqtt.connect(process.env.MQTT_URL, {
        clientId: `farmguard-${randomUUID()}`,
        username: process.env.MQTT_USERNAME || undefined,
        password: process.env.MQTT_PASSWORD || undefined,
        reconnectPeriod: 2000
      });
      this.mqttClient.on('connect', () => this.mqttClient.subscribe(topic, { qos: 1 }, (error) => {
        if (error) logEvent('error', 'telemetry.mqtt_subscribe_failed', { error: error.message });
        else logEvent('info', 'telemetry.mqtt_subscribed', { topic });
      }));
      this.mqttClient.on('message', (incomingTopic, payload) => {
        this.ingestMqtt(incomingTopic, payload).catch((error) =>
          logEvent('warn', 'telemetry.mqtt_rejected', { topic: incomingTopic, error: error.message }));
      });
      this.mqttClient.on('error', (error) =>
        logEvent('error', 'telemetry.mqtt_connection_failed', { error: error.message }));
    }
    logEvent('info', 'telemetry.pipeline_started', { mode: this.mode, mqtt: Boolean(this.mqttClient) });
  }

  async stop() {
    if (this.stream) await this.stream.close();
    if (this.mqttClient) await new Promise((resolve) => this.mqttClient.end(false, resolve));
    this.stream = null;
    this.mqttClient = null;
    this.mode = 'direct';
  }

  async recordBatch({ farm, messageId, capturedAt, sensorTypes, source }) {
    const event = await TelemetryEvent.create({
      farmId: farm._id, farmCode: farm.code, messageId, capturedAt, sensorTypes,
      source, ready: true, expiresAt: new Date(Date.now() + EVENT_TTL_MS)
    });
    // Direct processing is also a safety net if a stream disconnects between writes.
    await this.processEvent(event);
  }

  async ingestMqtt(topic, payload) {
    if (payload.length > 4096) throw new Error('MQTT payload exceeds 4 KiB');
    const match = /^farmguard\/([A-Za-z0-9-]{1,40})\/telemetry$/.exec(topic);
    if (!match) throw new Error('Invalid telemetry topic');
    let data;
    try { data = JSON.parse(payload.toString('utf8')); }
    catch { throw new Error('MQTT payload must be JSON'); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid telemetry payload');
    const farm = await Farm.findOne({ code: match[1], status: 'active' });
    if (!farm) throw new Error('Unknown or inactive farm');
    const messageId = data.messageId;
    const deviceId = data.deviceId;
    if (typeof messageId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(messageId)) {
      throw new Error('messageId must be a stable identifier');
    }
    if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(deviceId)) {
      throw new Error('deviceId is invalid');
    }
    const capturedAt = new Date(data.capturedAt);
    if (!Number.isFinite(capturedAt.getTime()) || Math.abs(Date.now() - capturedAt.getTime()) > 5 * 60 * 1000) {
      throw new Error('capturedAt must be within five minutes of now');
    }
    const sensorTypes = Object.keys(SENSOR_UNITS).filter((type) => data[type] !== undefined);
    if (sensorTypes.length === 0) throw new Error('No supported sensor readings');
    for (const type of sensorTypes) {
      const value = data[type];
      const [minimum, maximum] = SENSOR_LIMITS[type];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
        throw new Error(`Invalid ${type} reading`);
      }
    }

    let event;
    try {
      event = await TelemetryEvent.create({
        farmId: farm._id, farmCode: farm.code, messageId, capturedAt, sensorTypes,
        source: 'mqtt', ready: false, expiresAt: new Date(Date.now() + EVENT_TTL_MS)
      });
    } catch (error) {
      if (error.code === 11000) return { duplicate: true, messageId };
      throw error;
    }

    try {
      await Telemetry.insertMany(sensorTypes.map((type) => ({
        capturedAt,
        meta: { farmId: farm._id, farmCode: farm.code, deviceId, sensorType: type },
        value: data[type], unit: SENSOR_UNITS[type], messageId,
        correlationId: null, source: 'mqtt', quality: 'good'
      })), { ordered: false });
      await TelemetryEvent.updateOne({ _id: event._id }, { $set: { ready: true } });
    } catch (error) {
      // A partial unordered insert needs operator review before replay.
      logEvent('error', 'telemetry.mqtt_write_failed', { messageId, error: error.message });
      throw error;
    }

    const dashboardTypes = sensorTypes.filter((type) => type !== 'pump_current');
    if (dashboardTypes.length) {
      try {
        await Sensor.bulkWrite(dashboardTypes.map((type) => ({
          updateOne: {
            filter: { farm: farm._id, type },
            update: { $set: { lastValue: data[type], lastReadingAt: capturedAt, status: 'online' } }
          }
        })));
      } catch (error) {
        logEvent('warn', 'telemetry.sensor_snapshot_failed', { messageId, error: error.message });
      }
    }
    metric('smartfarm.telemetry.received', sensorTypes.length, 'c', { farm: farm.code, status: 'accepted', source: 'mqtt' });
    try { await this.processEvent({ ...event.toObject(), ready: true }); }
    catch (error) { logEvent('error', 'telemetry.direct_detection_failed', { messageId, error: error.message }); }
    return { duplicate: false, messageId, sensorTypes };
  }

  async processEvent(event) {
    if (!event.ready) return;
    realtimeService.broadcast('snapshot-invalidated', { at: new Date().toISOString(), source: event.source });
    for (const sensorType of event.sensorTypes.filter((type) => type in MIN_DELTA)) {
      const latest = await Telemetry.findOne({
        'meta.farmId': event.farmId, 'meta.sensorType': sensorType,
        messageId: event.messageId, capturedAt: event.capturedAt
      }).lean();
      if (!latest) continue;
      const baseline = await Telemetry.find({
        'meta.farmId': event.farmId,
        'meta.deviceId': latest.meta.deviceId,
        'meta.sensorType': sensorType,
        capturedAt: { $lt: event.capturedAt },
        quality: 'good'
      }).sort({ capturedAt: -1 }).limit(WINDOW).select('value').lean();
      if (baseline.length < WINDOW) continue;
      const mean = baseline.reduce((sum, item) => sum + item.value, 0) / WINDOW;
      const variance = baseline.reduce((sum, item) => sum + (item.value - mean) ** 2, 0) / WINDOW;
      const stdDev = Math.sqrt(variance);
      const delta = Math.abs(latest.value - mean);
      if (delta < MIN_DELTA[sensorType] || delta < 3 * Math.max(stdDev, 0.01)) continue;
      const evidence = {
        farmId: event.farmId, farmCode: event.farmCode, deviceId: latest.meta.deviceId,
        sensorType, messageId: event.messageId, capturedAt: event.capturedAt,
        value: latest.value, baselineMean: mean, baselineStdDev: stdDev,
        zScore: delta / Math.max(stdDev, 0.01), sampleCount: WINDOW, source: event.source
      };
      const result = await TelemetryAnomaly.updateOne(
        { farmId: event.farmId, deviceId: latest.meta.deviceId, sensorType, messageId: event.messageId },
        { $setOnInsert: evidence }, { upsert: true }
      );
      if (result.upsertedCount) {
        realtimeService.addEvent({
          farm: event.farmCode, type: 'warning',
          message: `${sensorType} anomaly: ${latest.value} vs rolling mean ${mean.toFixed(2)} (${evidence.zScore.toFixed(1)}σ).`
        });
        metric('smartfarm.telemetry.anomaly', 1, 'c', { farm: event.farmCode, sensor: sensorType });
        logEvent('warn', 'telemetry.anomaly_detected', { farmCode: event.farmCode, sensorType,
          messageId: event.messageId, value: latest.value, baselineMean: mean, zScore: evidence.zScore });
      }
    }
  }

  async recentAnomalies(limit = 10) {
    return TelemetryAnomaly.find().sort({ capturedAt: -1 }).limit(limit).lean();
  }

  async storageStats() {
    const stats = await mongoose.connection.db.command({ collStats: 'telemetry_ts' });
    return {
      collection: 'telemetry_ts',
      measurements: stats.count ?? await Telemetry.estimatedDocumentCount(),
      logicalBytes: stats.size,
      allocatedBytes: stats.storageSize,
      bucketCount: stats.timeseries?.bucketCount ?? null,
      measuredAt: new Date().toISOString()
    };
  }
}

export const telemetryPipelineService = new TelemetryPipelineService();
