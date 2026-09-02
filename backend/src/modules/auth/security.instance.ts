import { SecurityService } from './security.service.js';
import { store } from '../../common/redis/redis.js';

export const security = new SecurityService(store);
