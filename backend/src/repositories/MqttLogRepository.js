import { MqttLog } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const mqttLogRepository = new BaseRepository(MqttLog, ['farm', 'sensor']);
