import { mqttLogService } from '../services/MqttLogService.js';
import { BaseController } from './BaseController.js';

export const mqttLogController = new BaseController(mqttLogService, 'MQTT log');
