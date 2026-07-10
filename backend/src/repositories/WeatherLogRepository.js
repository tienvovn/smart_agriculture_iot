import { WeatherLog } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const weatherLogRepository = new BaseRepository(WeatherLog, ['farm']);
