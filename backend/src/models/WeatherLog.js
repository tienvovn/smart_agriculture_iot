import mongoose from 'mongoose';

const weatherLogSchema = new mongoose.Schema(
  {
    farm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farm',
      required: true,
      index: true
    },
    condition: {
      type: String,
      enum: ['sunny', 'cloudy', 'rainy', 'storm', 'dry', 'windy'],
      required: true,
      index: true
    },
    temperatureDelta: {
      type: Number,
      required: true
    },
    humidityDelta: {
      type: Number,
      required: true
    },
    temperatureAfter: {
      type: Number,
      required: true
    },
    humidityAfter: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    simulatedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'weather_logs'
  }
);

weatherLogSchema.index({ farm: 1, simulatedAt: -1 });
weatherLogSchema.index({ condition: 1, simulatedAt: -1 });

export const WeatherLog = mongoose.model('WeatherLog', weatherLogSchema);
