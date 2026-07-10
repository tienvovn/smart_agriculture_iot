import { weatherLogRepository } from '../repositories/WeatherLogRepository.js';
import { BaseService } from './BaseService.js';

export const weatherLogService = new BaseService(weatherLogRepository, 'Weather log', {
  searchFields: ['condition'],
  filterFields: ['farm', 'condition'],
  sortFields: ['simulatedAt', 'condition', 'createdAt', 'updatedAt']
});
