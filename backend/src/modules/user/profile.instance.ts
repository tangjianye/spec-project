import { userRepository } from './user.instance.js';
import { avatarStorage } from './avatar-storage.js';
import { ProfileService } from './profile.service.js';

export const profileService = new ProfileService(userRepository, avatarStorage);
