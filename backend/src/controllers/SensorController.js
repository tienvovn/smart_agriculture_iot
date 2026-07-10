import { sensorService } from '../services/SensorService.js';
import { BaseController } from './BaseController.js';

export const sensorController = new BaseController(sensorService, 'Sensor');
