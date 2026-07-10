import mongoose from 'mongoose';

const sensorSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    type: {
      type: String,
      enum: ['temperature', 'humidity', 'soil_ph'],
      required: true
    },
    unit: {
      type: String,
      enum: ['celsius', 'percent', 'ph'],
      required: true
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    mqttTopic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'maintenance'],
      default: 'online',
      index: true
    },
    lastValue: {
      type: Number,
      default: null
    },
    lastReadingAt: {
      type: Date,
      default: null,
      index: true
    },
    calibrationOffset: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    collection: 'sensors'
  }
);

sensorSchema.index({ deviceId: 1 }, { unique: true });
sensorSchema.index({ farm: 1, type: 1 }, { unique: true });
sensorSchema.index({ farm: 1, status: 1 });

export const Sensor = mongoose.model('Sensor', sensorSchema);
