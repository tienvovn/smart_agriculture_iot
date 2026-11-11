import mongoose from 'mongoose';

const incidentSchema = new mongoose.Schema(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    correlationId: { type: String, required: true, index: true },
    farm: { type: mongoose.Schema.Types.ObjectId, ref: 'Farm', required: true, index: true },
    command: { type: mongoose.Schema.Types.ObjectId, ref: 'PumpCommand', required: true },
    originalCommand: { type: mongoose.Schema.Types.ObjectId, ref: 'PumpCommand', default: null },
    type: { type: String, enum: ['pump_ack_timeout', 'pump_no_effect'], required: true },
    severity: { type: String, enum: ['warning', 'critical'], default: 'critical' },
    status: { type: String, enum: ['open', 'mitigating', 'resolved'], default: 'open', index: true },
    summary: { type: String, required: true },
    // When the farm actually stopped being irrigated (command published / ACK received).
    impactStartedAt: { type: Date, default: null },
    detectedAt: { type: Date, required: true, default: Date.now },
    mitigatingAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    resolution: { type: String, default: '' },
    recoveryEvidence: {
      ackReceived: { type: Boolean, default: false },
      pumpCurrentAmp: { type: Number, default: 0 },
      moistureBefore: { type: Number, default: null },
      moistureAfter: { type: Number, default: null }
    }
  },
  { timestamps: true, collection: 'incidents' }
);

incidentSchema.index({ farm: 1, status: 1, detectedAt: -1 });
incidentSchema.index({ detectedAt: -1 });
incidentSchema.index(
  { farm: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['open', 'mitigating'] } },
    name: 'one_active_incident_per_farm_and_type'
  }
);

export const Incident = mongoose.model('Incident', incidentSchema);
