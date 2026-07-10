import { pumpLogService } from '../services/PumpLogService.js';
import { BaseController } from './BaseController.js';

export const pumpLogController = new BaseController(pumpLogService, 'Pump log');
