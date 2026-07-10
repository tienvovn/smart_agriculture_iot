import { Farm } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const farmRepository = new BaseRepository(Farm, ['owner']);
