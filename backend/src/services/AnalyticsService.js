import { Farm, PumpLog, Sensor, SensorLog, WeatherLog } from '../models/index.js';

const sensorAveragesPipeline = [
  {
    $group: {
      _id: '$sensorType',
      average: { $avg: '$value' }
    }
  }
];

function averageFor(averages, sensorType) {
  return averages.find((item) => item._id === sensorType)?.average ?? null;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export const analyticsService = {
  async getDashboard() {
    const [totalFarms, totalSensors, onlineSensors, activePumps, todayPumpCount, averages] = await Promise.all([
      Farm.countDocuments(),
      Sensor.countDocuments(),
      Sensor.countDocuments({ status: 'online' }),
      Farm.countDocuments({ 'pump.status': 'on' }),
      PumpLog.countDocuments({ occurredAt: { $gte: startOfToday() } }),
      SensorLog.aggregate(sensorAveragesPipeline)
    ]);

    return {
      totalFarms,
      totalSensors,
      onlineSensors,
      averageTemperature: averageFor(averages, 'temperature'),
      averageHumidity: averageFor(averages, 'humidity'),
      averagePH: averageFor(averages, 'soil_ph'),
      activePumps,
      todayPumpCount
    };
  },

  async getStatistics() {
    const [averages, pumpUsage, farmCount, sensorCount, weatherDistribution] = await Promise.all([
      SensorLog.aggregate(sensorAveragesPipeline),
      PumpLog.aggregate([
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        }
      ]),
      Farm.countDocuments(),
      Sensor.countDocuments(),
      WeatherLog.aggregate([
        {
          $group: {
            _id: '$condition',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);

    return {
      averageTemperature: averageFor(averages, 'temperature'),
      averageHumidity: averageFor(averages, 'humidity'),
      averagePH: averageFor(averages, 'soil_ph'),
      pumpUsage: Object.fromEntries(pumpUsage.map((item) => [item._id, item.count])),
      farmCount,
      sensorCount,
      weatherDistribution: Object.fromEntries(
        weatherDistribution.map((item) => [item._id, item.count])
      )
    };
  }
};
