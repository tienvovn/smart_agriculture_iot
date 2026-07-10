import { Sensor } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const sensorRepository = new BaseRepository(Sensor, ['farm']);
