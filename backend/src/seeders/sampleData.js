export const sampleUsers = [
  {
    fullName: 'System Administrator',
    email: 'admin@smartfarm.local',
    password: 'Admin@123456',
    role: 'admin'
  },
  {
    fullName: 'Farm Operator',
    email: 'operator@smartfarm.local',
    password: 'Operator@123456',
    role: 'operator'
  }
];

export const sampleFarms = [
  {
    name: 'Green Valley Farm',
    code: 'FARM-001',
    location: {
      address: 'Zone A',
      city: 'Ho Chi Minh City',
      country: 'Vietnam',
      geo: { type: 'Point', coordinates: [106.6297, 10.8231] }
    },
    cropType: 'Lettuce',
    thresholds: {
      humidityMin: 50,
      pumpRunMinutes: 30,
      temperatureMin: 18,
      temperatureMax: 34,
      soilPhMin: 5.8,
      soilPhMax: 7.0
    }
  },
  {
    name: 'Sunrise Hydroponic Farm',
    code: 'FARM-002',
    location: {
      address: 'Zone B',
      city: 'Da Lat',
      country: 'Vietnam',
      geo: { type: 'Point', coordinates: [108.4583, 11.9404] }
    },
    cropType: 'Tomato',
    thresholds: {
      humidityMin: 50,
      pumpRunMinutes: 30,
      temperatureMin: 16,
      temperatureMax: 30,
      soilPhMin: 6.0,
      soilPhMax: 6.8
    }
  },
  {
    name: 'Mekong Smart Field',
    code: 'FARM-003',
    location: {
      address: 'Zone C',
      city: 'Can Tho',
      country: 'Vietnam',
      geo: { type: 'Point', coordinates: [105.7469, 10.0452] }
    },
    cropType: 'Cucumber',
    thresholds: {
      humidityMin: 50,
      pumpRunMinutes: 30,
      temperatureMin: 20,
      temperatureMax: 36,
      soilPhMin: 5.5,
      soilPhMax: 7.2
    }
  }
];

export const sensorDefinitions = [
  {
    type: 'temperature',
    unit: 'celsius',
    label: 'Temperature Sensor'
  },
  {
    type: 'humidity',
    unit: 'percent',
    label: 'Humidity Sensor'
  },
  {
    type: 'soil_ph',
    unit: 'ph',
    label: 'Soil pH Sensor'
  }
];

export const initialReadings = {
  'FARM-001': {
    temperature: 29.4,
    humidity: 47.5,
    soil_ph: 6.4,
    weather: {
      condition: 'dry',
      temperatureDelta: 1.8,
      humidityDelta: -8.5
    }
  },
  'FARM-002': {
    temperature: 23.2,
    humidity: 68.2,
    soil_ph: 6.3,
    weather: {
      condition: 'cloudy',
      temperatureDelta: -1.2,
      humidityDelta: 4.1
    }
  },
  'FARM-003': {
    temperature: 31.7,
    humidity: 57.8,
    soil_ph: 6.8,
    weather: {
      condition: 'sunny',
      temperatureDelta: 2.4,
      humidityDelta: -3.2
    }
  }
};
