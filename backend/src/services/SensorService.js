import { sensorRepository } from '../repositories/SensorRepository.js';
import { BaseService } from './BaseService.js';

export const sensorService = new BaseService(sensorRepository, 'Sensor', {
  searchFields: ['name', 'deviceId', 'mqttTopic'],
  filterFields: ['farm', 'type', 'unit', 'status'],
  sortFields: ['name', 'type', 'status', 'lastValue', 'lastReadingAt', 'createdAt', 'updatedAt']
});
