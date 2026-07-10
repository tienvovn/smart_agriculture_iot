import { User } from '../models/index.js';
import { BaseRepository } from './BaseRepository.js';

export const userRepository = new BaseRepository(User);
