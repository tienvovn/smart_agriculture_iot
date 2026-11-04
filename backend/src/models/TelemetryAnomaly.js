import mongoose from 'mongoose';

const telemetryAnomalySchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, required: true },
  farmCode: { type: String, required: true },
  deviceId: { type: String, required: true },
  sensorType: { type: String, required: true },
  messageId: { type: String, required: true },
  capturedAt: { type: Date, required: true },
  value: { type: Number, required: true },
  baselineMean: { type: Number, required: true },
  baselineStdDev: { type: Number, required: true },
  zScore: { type: Number, required: true },
  sampleCount: { type: Number, required: true },
  source: { type: String, enum: ['simulator', 'mqtt'], required: true }
}, { collection: 'telemetry_anomalies', timestamps: true });

telemetryAnomalySchema.index({ farmId: 1, deviceId: 1, sensorType: 1, messageId: 1 }, { unique: true });
telemetryAnomalySchema.index({ capturedAt: -1 });

export const TelemetryAnomaly = mongoose.model('TelemetryAnomaly', telemetryAnomalySchema);
