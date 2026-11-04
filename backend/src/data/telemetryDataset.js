import { createHash } from 'node:crypto';
import mongoose from 'mongoose';

const { calculateObjectSize, serialize } = mongoose.mongo.BSON;

export const SENSOR_TYPES = [
  { type: 'temperature', unit: 'celsius', base: 28, amplitude: 6, minimum: -20, maximum: 60 },
  { type: 'humidity', unit: 'percent', base: 58, amplitude: 18, minimum: 0, maximum: 100 },
  { type: 'soil_ph', unit: 'ph', base: 6.4, amplitude: 0.7, minimum: 0, maximum: 14 },
  { type: 'pump_current', unit: 'ampere', base: 0, amplitude: 1.8, minimum: 0, maximum: 20 }
];

function hashSeed(seed) {
  let value = 2166136261;
  for (const character of String(seed)) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function mulberry32(seed) {
  let value = seed;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicObjectId(namespace, index) {
  const hex = createHash('sha256').update(`${namespace}:${index}`).digest('hex').slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function createTelemetryGenerator(options = {}) {
  const seed = String(options.seed || 'farmguard-100gb-v1');
  const datasetId = options.datasetId || createHash('sha256').update(seed).digest('hex').slice(0, 12);
  const farmCount = Number(options.farmCount || 2500);
  const intervalSeconds = Number(options.intervalSeconds || 10);
  const startAt = new Date(options.startAt || '2026-10-10T12:00:00.000Z');
  const random = mulberry32(hashSeed(seed));
  let documentIndex = 0;

  if (!Number.isInteger(farmCount) || farmCount < 1) throw new Error('farmCount must be a positive integer');
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) throw new Error('intervalSeconds must be positive');
  if (Number.isNaN(startAt.getTime())) throw new Error('startAt must be a valid date');

  return {
    seed,
    datasetId,
    farmCount,
    intervalSeconds,
    startAt,
    next() {
      const seriesPerTick = farmCount * SENSOR_TYPES.length;
      const tick = Math.floor(documentIndex / seriesPerTick);
      const withinTick = documentIndex % seriesPerTick;
      const farmIndex = Math.floor(withinTick / SENSOR_TYPES.length);
      const sensor = SENSOR_TYPES[withinTick % SENSOR_TYPES.length];
      const farmCode = `BENCH-${String(farmIndex + 1).padStart(4, '0')}`;
      const phase = (tick % 8640) / 8640 * Math.PI * 2;
      const noise = (random() - 0.5) * sensor.amplitude * 0.08;
      const pumpOn = (tick + farmIndex * 17) % 180 < 18;
      let value;

      if (sensor.type === 'pump_current') value = pumpOn ? 1.8 + noise : 0;
      else if (sensor.type === 'humidity') value = sensor.base + Math.sin(phase + farmIndex) * sensor.amplitude + (pumpOn ? 4 : 0) + noise;
      else value = sensor.base + Math.sin(phase + farmIndex / 3) * sensor.amplitude + noise;

      const capturedAt = new Date(startAt.getTime() + tick * intervalSeconds * 1000);
      const document = {
        capturedAt,
        meta: {
          farmId: deterministicObjectId(datasetId, farmIndex),
          farmCode,
          deviceId: `${farmCode}-${sensor.type.toUpperCase()}`,
          sensorType: sensor.type
        },
        value: round(clamp(value, sensor.minimum, sensor.maximum)),
        unit: sensor.unit,
        messageId: `${datasetId}-${tick}-${farmIndex}`,
        correlationId: null,
        source: 'simulator',
        quality: 'good'
      };
      documentIndex += 1;
      return { document, bsonBytes: calculateObjectSize(document), index: documentIndex - 1 };
    }
  };
}

export function estimateDataset(options = {}) {
  const targetGiB = Number(options.targetGiB || 100);
  const sampleDocuments = Number(options.sampleDocuments || 2000);
  const generator = createTelemetryGenerator(options);
  let sampleBytes = 0;
  for (let index = 0; index < sampleDocuments; index += 1) sampleBytes += generator.next().bsonBytes;

  const averageBsonBytes = sampleBytes / sampleDocuments;
  const targetBytes = Math.round(targetGiB * 1024 ** 3);
  const estimatedDocuments = Math.ceil(targetBytes / averageBsonBytes);
  const documentsPerTick = generator.farmCount * SENSOR_TYPES.length;
  const estimatedTicks = Math.ceil(estimatedDocuments / documentsPerTick);
  const simulatedDurationSeconds = estimatedTicks * generator.intervalSeconds;

  return {
    datasetId: generator.datasetId,
    seed: generator.seed,
    targetGiB,
    targetLogicalBsonBytes: targetBytes,
    averageBsonBytes: round(averageBsonBytes),
    estimatedDocuments,
    farmCount: generator.farmCount,
    sensorTypes: SENSOR_TYPES.length,
    intervalSeconds: generator.intervalSeconds,
    startAt: generator.startAt.toISOString(),
    estimatedEndAt: new Date(generator.startAt.getTime() + simulatedDurationSeconds * 1000).toISOString(),
    simulatedDurationDays: round(simulatedDurationSeconds / 86400),
    note: 'Logical BSON size is not physical disk usage. MongoDB time-series bucket compression should use less storage.'
  };
}

export function createDatasetDigest() {
  const hash = createHash('sha256');
  return {
    update(document) {
      hash.update(serialize(document));
    },
    digest() {
      return hash.digest('hex');
    }
  };
}

export function validateTelemetryDocument(document) {
  const sensor = SENSOR_TYPES.find((item) => item.type === document.meta?.sensorType);
  const errors = [];
  if (!(document.capturedAt instanceof Date) || Number.isNaN(document.capturedAt.getTime())) errors.push('invalid capturedAt');
  if (!sensor) errors.push('unknown sensorType');
  if (!document.meta?.farmId || !document.meta?.deviceId) errors.push('missing stable metadata');
  if (!document.messageId) errors.push('missing messageId');
  if (sensor && (document.value < sensor.minimum || document.value > sensor.maximum)) errors.push('value outside physical range');
  if (sensor && document.unit !== sensor.unit) errors.push('unit does not match sensorType');
  return errors;
}
