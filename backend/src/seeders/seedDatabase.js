import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  Farm,
  MqttLog,
  Incident,
  PumpCommand,
  PumpLog,
  Sensor,
  SensorLog,
  Telemetry,
  User,
  WeatherLog
} from '../models/index.js';
import {
  initialReadings,
  sampleFarms,
  sampleUsers,
  sensorDefinitions
} from './sampleData.js';

dotenv.config();

const shouldClearOnly = process.argv.includes('--clear');

async function clearDatabase() {
  await Promise.all([
    User.deleteMany({}),
    Farm.deleteMany({}),
    Sensor.deleteMany({}),
    SensorLog.deleteMany({}),
    PumpLog.deleteMany({}),
    WeatherLog.deleteMany({}),
    MqttLog.deleteMany({}),
    PumpCommand.deleteMany({}),
    Incident.deleteMany({})
  ]);

  try {
    await Telemetry.collection.drop();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== 'NamespaceNotFound') throw error;
  }
}

function buildCapturedAt(farmIndex, sensorIndex) {
  const capturedAt = new Date();
  capturedAt.setMinutes(capturedAt.getMinutes() - (farmIndex * 10 + sensorIndex * 2));
  return capturedAt;
}

async function seedUsers() {
  const users = [];

  for (const user of sampleUsers) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    users.push({
      fullName: user.fullName,
      email: user.email,
      passwordHash,
      role: user.role
    });
  }

  return User.insertMany(users);
}

async function seedFarms(ownerId) {
  return Farm.insertMany(
    sampleFarms.map((farm) => ({
      ...farm,
      owner: ownerId,
      status: 'active',
      pump: {
        status: 'off',
        mode: 'auto',
        startedAt: null,
        scheduledStopAt: null,
        lastChangedAt: null
      }
    }))
  );
}

async function seedSensorsAndLogs(farms) {
  for (const [farmIndex, farm] of farms.entries()) {
    const readings = initialReadings[farm.code];
    const weather = readings.weather;
    const simulatedAt = buildCapturedAt(farmIndex, 0);

    const weatherLog = await WeatherLog.create({
      farm: farm._id,
      condition: weather.condition,
      temperatureDelta: weather.temperatureDelta,
      humidityDelta: weather.humidityDelta,
      temperatureAfter: readings.temperature,
      humidityAfter: readings.humidity,
      simulatedAt
    });

    for (const [sensorIndex, definition] of sensorDefinitions.entries()) {
      const value = readings[definition.type];
      const capturedAt = buildCapturedAt(farmIndex, sensorIndex);

      const sensor = await Sensor.create({
        farm: farm._id,
        name: `${farm.name} ${definition.label}`,
        type: definition.type,
        unit: definition.unit,
        deviceId: `${farm.code}-${definition.type.toUpperCase().replace('_', '-')}`,
        mqttTopic: `smart-farm/${farm.code.toLowerCase()}/sensor/${definition.type}`,
        status: 'online',
        lastValue: value,
        lastReadingAt: capturedAt
      });

      const sensorLog = await SensorLog.create({
        farm: farm._id,
        sensor: sensor._id,
        sensorType: definition.type,
        value,
        unit: definition.unit,
        source: 'simulator',
        capturedAt,
        metadata: {
          weatherLog: ['temperature', 'humidity'].includes(definition.type) ? weatherLog._id : null
        }
      });

      if (definition.type === 'humidity' && value < farm.thresholds.humidityMin) {
        const startedAt = capturedAt;
        const stoppedAt = new Date(startedAt.getTime() + farm.thresholds.pumpRunMinutes * 60 * 1000);

        await PumpLog.create({
          farm: farm._id,
          action: 'turned_on',
          trigger: 'auto_humidity_low',
          mode: 'auto',
          humidityValue: value,
          threshold: farm.thresholds.humidityMin,
          runDurationMinutes: farm.thresholds.pumpRunMinutes,
          startedAt,
          occurredAt: startedAt,
          relatedSensorLog: sensorLog._id
        });

        await PumpLog.create({
          farm: farm._id,
          action: 'turned_off',
          trigger: 'auto_duration_complete',
          mode: 'auto',
          humidityValue: value,
          threshold: farm.thresholds.humidityMin,
          runDurationMinutes: farm.thresholds.pumpRunMinutes,
          startedAt,
          stoppedAt,
          occurredAt: stoppedAt,
          relatedSensorLog: sensorLog._id
        });

        await Farm.updateOne(
          { _id: farm._id },
          {
            $set: {
              'pump.status': 'off',
              'pump.mode': 'auto',
              'pump.startedAt': startedAt,
              'pump.scheduledStopAt': stoppedAt,
              'pump.lastChangedAt': stoppedAt
            }
          }
        );
      }
    }

    await MqttLog.create({
      farm: farm._id,
      topic: `smart-farm/${farm.code.toLowerCase()}/status`,
      direction: 'incoming',
      messageType: 'device_status',
      payload: {
        farmCode: farm.code,
        status: 'online',
        note: 'Sample MQTT placeholder for future broker integration'
      },
      qos: 1,
      retained: false,
      receivedAt: simulatedAt,
      processedAt: simulatedAt,
      processingStatus: 'processed'
    });
  }
}

async function run() {
  try {
    await connectDatabase();
    await clearDatabase();

    if (shouldClearOnly) {
      console.log('Database cleared.');
      return;
    }

    const users = await seedUsers();
    const owner = users.find((user) => user.role === 'admin') || users[0];
    const farms = await seedFarms(owner._id);
    await seedSensorsAndLogs(farms);

    console.log('Database seeded successfully.');
    console.log(`Users: ${users.length}`);
    console.log(`Farms: ${farms.length}`);
    console.log(`Sensors: ${await Sensor.countDocuments()}`);
    console.log(`Sensor logs: ${await SensorLog.countDocuments()}`);
    console.log(`Pump logs: ${await PumpLog.countDocuments()}`);
    console.log(`Weather logs: ${await WeatherLog.countDocuments()}`);
    console.log(`MQTT logs: ${await MqttLog.countDocuments()}`);
  } finally {
    await disconnectDatabase();
  }
}

run().catch(async (error) => {
  console.error(error);
  await disconnectDatabase();
  process.exit(1);
});
