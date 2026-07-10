import { farmRepository } from '../repositories/FarmRepository.js';
import { BaseService } from './BaseService.js';

export const farmService = new BaseService(farmRepository, 'Farm', {
  searchFields: ['name', 'code', 'location.city', 'cropType'],
  filterFields: ['owner', 'status', 'cropType'],
  sortFields: ['name', 'code', 'status', 'createdAt', 'updatedAt']
});
