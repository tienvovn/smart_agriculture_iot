import { SensorLog } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const sensorLogRepository = new BaseRepository(SensorLog, ['farm', 'sensor']);
