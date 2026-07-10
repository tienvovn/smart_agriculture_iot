import { pumpLogRepository } from '../repositories/PumpLogRepository.js';
import { BaseService } from './BaseService.js';

export const pumpLogService = new BaseService(pumpLogRepository, 'Pump log', {
  searchFields: ['action', 'trigger', 'mode'],
  filterFields: ['farm', 'action', 'trigger', 'mode', 'requestedBy'],
  sortFields: ['occurredAt', 'action', 'trigger', 'createdAt', 'updatedAt']
});
