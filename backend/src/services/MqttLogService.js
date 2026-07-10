import { mqttLogRepository } from '../repositories/MqttLogRepository.js';
import { BaseService } from './BaseService.js';

export const mqttLogService = new BaseService(mqttLogRepository, 'MQTT log', {
  searchFields: ['topic', 'errorMessage'],
  filterFields: ['farm', 'sensor', 'direction', 'messageType', 'qos', 'retained', 'processingStatus'],
  sortFields: ['receivedAt', 'processedAt', 'topic', 'processingStatus', 'createdAt', 'updatedAt']
});
