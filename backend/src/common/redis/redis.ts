/**
 * Redis 客户端封装（T006）
 * 职责：验证码、频控滑动窗口、错误累计、令牌吊销列表。
 * 当 USE_IN_MEMORY_STORE=true（测试/无 Redis）时退化为内存实现，保证可单测与本地验证。
 */
import { Redis } from 'ioredis';
import { config } from '../../config/env.js';

export interface KVStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  zAdd(key: string, score: number, member: string): Promise<void>;
  zCount(key: string, minScore: number, maxScore: number): Promise<number>;
}

class RedisStore implements KVStore {
  private readonly client: Redis;
  constructor(url: string) {
    this.client = new Redis(url);
  }
  async get(key: string) {
    return this.client.get(key);
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }
  async setNX(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds !== undefined) {
      return (await this.client.set(key, value, 'EX', ttlSeconds, 'NX')) === 'OK';
    }
    return (await this.client.setnx(key, value)) === 1;
  }
  async incr(key: string) {
    return this.client.incr(key);
  }
  async expire(key: string, ttlSeconds: number) {
    await this.client.expire(key, ttlSeconds);
  }
  async del(key: string) {
    await this.client.del(key);
  }
  async zAdd(key: string, score: number, member: string) {
    await this.client.zadd(key, score, member);
  }
  async zCount(key: string, minScore: number, maxScore: number) {
    return this.client.zcount(key, minScore, maxScore);
  }
}

class InMemoryStore implements KVStore {
  private readonly map = new Map<string, { value: string; expireAt?: number }>();
  private readonly zsets = new Map<string, Map<string, number>>();

  private alive(key: string) {
    const item = this.map.get(key);
    if (!item) return false;
    if (item.expireAt !== undefined && item.expireAt <= Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }
  async get(key: string) {
    return this.alive(key) ? (this.map.get(key)?.value ?? null) : null;
  }
  async set(key: string, value: string, ttlSeconds?: number) {
    this.map.set(key, {
      value,
      expireAt: ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined
    });
  }
  async setNX(key: string, value: string, ttlSeconds?: number) {
    if (this.alive(key)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }
  async incr(key: string) {
    const cur = (await this.get(key)) ?? '0';
    const next = Number.parseInt(cur, 10) + 1;
    const item = this.map.get(key);
    await this.set(key, String(next), item?.expireAt ? (item.expireAt - Date.now()) / 1000 : undefined);
    return next;
  }
  async expire(key: string, ttlSeconds: number) {
    const item = this.map.get(key);
    if (item) item.expireAt = Date.now() + ttlSeconds * 1000;
  }
  async del(key: string) {
    this.map.delete(key);
  }
  async zAdd(key: string, score: number, member: string) {
    let set = this.zsets.get(key);
    if (!set) {
      set = new Map();
      this.zsets.set(key, set);
    }
    set.set(member, score);
  }
  async zCount(key: string, minScore: number, maxScore: number) {
    const set = this.zsets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const score of set.values()) {
      if (score >= minScore && score <= maxScore) count++;
    }
    return count;
  }
}

export function createStore(): KVStore {
  return config.useInMemoryStore ? new InMemoryStore() : new RedisStore(config.redisUrl);
}

export const store: KVStore = createStore();
