import mongoose from 'mongoose';

const sensorLogSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
      index: true
    },
    sensor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sensor',
      required: true,
      index: true
    },
    sensorType: {
      type: String,
      enum: ['temperature', 'humidity', 'soil_ph'],
      required: true,
      index: true
    },
    value: {
      type: Number,
      required: true
    },
    unit: {
      type: String,
      enum: ['celsius', 'percent', 'ph'],
      required: true
    },
    source: {
      type: String,
      enum: ['simulator', 'mqtt', 'manual'],
      default: 'simulator',
      index: true
    },
    capturedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    metadata: {
      weatherLog: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WeatherLog',
        default: null
      },
      mqttLog: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MqttLog',
        default: null
      }
    }
  },
  {
    timestamps: true,
    collection: 'sensor_logs'
  }
);

sensorLogSchema.index({ farm: 1, sensorType: 1, capturedAt: -1 });
sensorLogSchema.index({ sensor: 1, capturedAt: -1 });
sensorLogSchema.index({ capturedAt: -1 });

export const SensorLog = mongoose.model('SensorLog', sensorLogSchema);
