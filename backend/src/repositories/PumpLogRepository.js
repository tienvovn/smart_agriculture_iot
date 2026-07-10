import { PumpLog } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const pumpLogRepository = new BaseRepository(PumpLog, [
  'farm',
  'requestedBy',
  'relatedSensorLog'
]);
