import { sensorLogRepository } from '../repositories/SensorLogRepository.js';
import { BaseService } from './BaseService.js';

export const sensorLogService = new BaseService(sensorLogRepository, 'Sensor log', {
  searchFields: ['source'],
  filterFields: ['farm', 'sensor', 'sensorType', 'unit', 'source'],
  sortFields: ['capturedAt', 'value', 'createdAt', 'updatedAt']
});
