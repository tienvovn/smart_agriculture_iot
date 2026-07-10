import { weatherLogService } from '../services/WeatherLogService.js';
import { BaseController } from './BaseController.js';

export const weatherLogController = new BaseController(weatherLogService, 'Weather log');
