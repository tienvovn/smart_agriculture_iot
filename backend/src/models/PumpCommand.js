import mongoose from 'mongoose';

const pumpCommandSchema = new mongoose.Schema(
  {
    commandId: { type: String, required: true, unique: true, index: true },
    correlationId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    pumpId: { type: String, required: true },
    action: { type: String, enum: ['ON', 'OFF'], required: true },
    status: {
      type: String,
      enum: ['pending', 'published', 'acknowledged', 'effect_confirmed', 'ack_timeout', 'failed'],
      default: 'pending',
      index: true
    },
    requestedAt: { type: Date, required: true, default: Date.now },
    publishedAt: { type: Date, default: null },
    acknowledgedAt: { type: Date, default: null },
    effectConfirmedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
    retryCount: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: '' },
    ruleEvidence: {
      humidityValue: Number,
      threshold: Number,
      sampleCount: Number
    },
    acknowledgement: {
      deviceId: String,
      pumpCurrentAmp: Number
    }
  },
  { timestamps: true, collection: 'pump_commands' }
);

pumpCommandSchema.index({ farm: 1, requestedAt: -1 });
pumpCommandSchema.index({ farm: 1, status: 1, requestedAt: -1 });

export const PumpCommand = mongoose.model('PumpCommand', pumpCommandSchema);
