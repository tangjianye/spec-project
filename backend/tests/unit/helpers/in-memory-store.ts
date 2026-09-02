/**
 * 单测辅助：内存 KVStore（避免依赖 Redis）
 */
import type { KVStore } from '../../../src/common/redis/redis.js';

export class InMemoryStore implements KVStore {
  private readonly map = new Map<string, { value: string; expireAt?: number }>();
  private readonly zsets = new Map<string, Map<string, number>>();

  private alive(key: string): boolean {
    const item = this.map.get(key);
    if (!item) return false;
    if (item.expireAt !== undefined && item.expireAt <= Date.now()) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  async get(key: string): Promise<string | null> {
    return this.alive(key) ? (this.map.get(key)?.value ?? null) : null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.map.set(key, {
      value,
      expireAt: ttlSeconds !== undefined ? Date.now() + ttlSeconds * 1000 : undefined
    });
  }

  async setNX(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (this.alive(key)) return false;
    await this.set(key, value, ttlSeconds);
    return true;
  }

  async incr(key: string): Promise<number> {
    const cur = (await this.get(key)) ?? '0';
    const next = Number.parseInt(cur, 10) + 1;
    const item = this.map.get(key);
    await this.set(key, String(next), item?.expireAt ? (item.expireAt - Date.now()) / 1000 : undefined);
    return next;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const item = this.map.get(key);
    if (item) item.expireAt = Date.now() + ttlSeconds * 1000;
  }

  async del(key: string): Promise<void> {
    this.map.delete(key);
  }

  async zAdd(key: string, score: number, member: string): Promise<void> {
    let set = this.zsets.get(key);
    if (!set) {
      set = new Map();
      this.zsets.set(key, set);
    }
    set.set(member, score);
  }

  async zCount(key: string, minScore: number, maxScore: number): Promise<number> {
    const set = this.zsets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const score of set.values()) {
      if (score >= minScore && score <= maxScore) count++;
    }
    return count;
  }
}
