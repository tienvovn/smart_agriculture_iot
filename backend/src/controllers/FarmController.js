import { farmService } from '../services/FarmService.js';
import { BaseController } from './BaseController.js';

export const farmController = new BaseController(farmService, 'Farm');
