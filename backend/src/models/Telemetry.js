import mongoose from 'mongoose';

const telemetrySchema = new mongoose.Schema(
  {
    capturedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    meta: {
      farmId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      farmCode: {
        type: String,
        required: true
      },
      deviceId: {
        type: String,
        required: true
      },
      sensorType: {
        type: String,
        enum: ['temperature', 'humidity', 'soil_ph', 'pump_current', 'air_humidity', 'pump_relay'],
        required: true
      }
    },
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['celsius', 'percent', 'ph', 'ampere', 'state'],
      required: true
    },
    messageId: {
      type: String,
      required: true
    },
    correlationId: {
      type: String,
      default: null
    },
    source: {
      type: String,
      enum: ['simulator', 'mqtt', 'hardware'],
      default: 'simulator'
    },
    quality: {
      type: String,
      enum: ['good', 'suspect', 'bad'],
      default: 'good'
    }
  },
  {
    collection: 'telemetry_ts',
    versionKey: false,
    timeseries: {
      timeField: 'capturedAt',
      metaField: 'meta',
      granularity: 'seconds'
    },
    expireAfterSeconds: 60 * 60 * 24 * 30
  }
);

telemetrySchema.index({ 'meta.farmId': 1, 'meta.sensorType': 1, capturedAt: -1 });

export const Telemetry = mongoose.model('Telemetry', telemetrySchema);
