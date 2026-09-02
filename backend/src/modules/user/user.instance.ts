import { UserRepository } from './user.entity.js';

export const userRepository = new UserRepository();
userRepository.seed();
