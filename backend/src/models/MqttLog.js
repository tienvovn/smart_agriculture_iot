import mongoose from 'mongoose';

const mqttLogSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      default: null,
      index: true
    },
    sensor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sensor',
      default: null,
      index: true
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      index: true,
      maxlength: 180
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: true,
      index: true
    },
    messageType: {
      type: String,
      enum: ['sensor_reading', 'pump_command', 'device_status', 'unknown'],
      default: 'unknown',
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    qos: {
      type: Number,
      enum: [0, 1, 2],
      default: 0
    },
    retained: {
      type: Boolean,
      default: false
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    processedAt: {
      type: Date,
      default: null
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'processed', 'failed'],
      default: 'pending',
      index: true
    },
    errorMessage: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    collection: 'mqtt_logs'
  }
);

mqttLogSchema.index({ topic: 1, receivedAt: -1 });
mqttLogSchema.index({ farm: 1, messageType: 1, receivedAt: -1 });
mqttLogSchema.index({ processingStatus: 1, receivedAt: 1 });

export const MqttLog = mongoose.model('MqttLog', mqttLogSchema);
