import { userRepository } from '../repositories/UserRepository.js';
import { BaseService } from './BaseService.js';

export const userService = new BaseService(userRepository, 'User', {
  searchFields: ['fullName', 'email'],
  filterFields: ['role', 'isActive'],
  sortFields: ['fullName', 'email', 'role', 'lastLoginAt', 'createdAt', 'updatedAt']
});
