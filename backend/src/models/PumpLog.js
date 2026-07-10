import mongoose from 'mongoose';

const pumpLogSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
      index: true
    },
    action: {
      type: String,
      enum: ['turned_on', 'turned_off'],
      required: true,
      index: true
    },
    trigger: {
      type: String,
      enum: ['auto_humidity_low', 'auto_duration_complete', 'manual', 'system'],
      required: true,
      index: true
    },
    mode: {
      type: String,
      enum: ['auto', 'manual'],
      required: true
    },
    humidityValue: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    threshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    runDurationMinutes: {
      type: Number,
      default: 30,
      min: 1
    },
    startedAt: {
      type: Date,
      default: null
    },
    stoppedAt: {
      type: Date,
      default: null
    },
    occurredAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    relatedSensorLog: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SensorLog',
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'pump_logs'
  }
);

pumpLogSchema.index({ farm: 1, occurredAt: -1 });
pumpLogSchema.index({ farm: 1, action: 1, occurredAt: -1 });
pumpLogSchema.index({ trigger: 1, occurredAt: -1 });

export const PumpLog = mongoose.model('PumpLog', pumpLogSchema);
