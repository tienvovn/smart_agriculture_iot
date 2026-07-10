import mongoose from 'mongoose';

const thresholdSchema = new mongoose.Schema(
  {
    humidityMin: {
      type: Number,
      default: 50,
      min: 0,
      max: 100
    },
    pumpRunMinutes: {
      type: Number,
      default: 30,
      min: 1,
      max: 240
    },
    temperatureMin: {
      type: Number,
      default: 16
    },
    temperatureMax: {
      type: Number,
      default: 38
    },
    soilPhMin: {
      type: Number,
      default: 5.5,
      min: 0,
      max: 14
    },
    soilPhMax: {
      type: Number,
      default: 7.5,
      min: 0,
      max: 14
    }
  },
  { _id: false }
);

const pumpStateSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['on', 'off'],
      default: 'off',
      index: true
    },
    mode: {
      type: String,
      enum: ['auto', 'manual'],
      default: 'auto'
    },
    startedAt: {
      type: Date,
      default: null
    },
    scheduledStopAt: {
      type: Date,
      default: null
    },
    lastChangedAt: {
      type: Date,
      default: null
    }
  },
  { _id: false }
);

const farmSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 40
    },
    location: {
      address: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: 'Vietnam' },
      geo: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],
          validate: {
            validator(value) {
              return (
                value.length === 2 &&
                value[0] >= -180 &&
                value[0] <= 180 &&
                value[1] >= -90 &&
                value[1] <= 90
              );
            },
            message: 'Geo coordinates must be [longitude, latitude]'
          }
        }
      }
    },
    cropType: {
      type: String,
      trim: true,
      default: 'Mixed vegetables'
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    thresholds: {
      type: thresholdSchema,
      default: () => ({})
    },
    pump: {
      type: pumpStateSchema,
      default: () => ({})
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'farms'
  }
);

farmSchema.index({ code: 1 }, { unique: true });
farmSchema.index({ owner: 1, status: 1 });
farmSchema.index({ 'location.geo': '2dsphere' }, { sparse: true });

export const Farm = mongoose.model('Farm', farmSchema);
