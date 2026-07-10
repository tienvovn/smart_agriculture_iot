import { sensorLogService } from '../services/SensorLogService.js';
import { BaseController } from './BaseController.js';

export const sensorLogController = new BaseController(sensorLogService, 'Sensor log');
