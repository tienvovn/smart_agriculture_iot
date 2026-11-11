import mongoose from 'mongoose';

const telemetryEventSchema = new mongoose.Schema({
  farmId: { type: mongoose.Schema.Types.ObjectId, required: true },
  farmCode: { type: String, required: true },
  messageId: { type: String, required: true },
  capturedAt: { type: Date, required: true },
  sensorTypes: [{ type: String, required: true }],
  source: { type: String, enum: ['simulator', 'mqtt', 'hardware'], required: true },
  ready: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true }
}, { collection: 'telemetry_events', versionKey: false });

telemetryEventSchema.index({ farmId: 1, messageId: 1 }, { unique: true });
telemetryEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TelemetryEvent = mongoose.model('TelemetryEvent', telemetryEventSchema);
