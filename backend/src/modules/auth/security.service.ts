/**
 * 安全策略引擎（T010）——对齐 data-model V-07/V-10
 * 提供：滑动窗口频控、错误累计计数、危险字符检测。
 */
import validator from 'validator';
import type { KVStore } from '../../common/redis/redis.js';
import { config } from '../../config/env.js';

export type WindowKey = 'ip' | 'phone';

export class SecurityService {
  constructor(private readonly kv: KVStore) {}

  // ===== 频控（滑动窗口，对齐 spec FR-008 / data-model V-07） =====

  async checkRateLimit(windowKey: WindowKey, subject: string): Promise<boolean> {
    const now = Date.now();
    if (windowKey === 'ip') {
      const key = `rl:ip:${subject}`;
      const start = now - 60_000;
      const count = await this.kv.zCount(key, start, now);
      const allowed = count < config.ipRateLimitPerMinute;
      if (allowed) {
        await this.kv.zAdd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
        await this.kv.expire(key, 90);
      }
      return allowed;
    }
    // phone：1 小时窗口
    const key = `rl:phone:${subject}`;
    const start = now - 3_600_000;
    const count = await this.kv.zCount(key, start, now);
    const allowed = count < config.phoneRateLimitPerHour;
    if (allowed) {
      await this.kv.zAdd(key, now, `${now}:${Math.random().toString(36).slice(2)}`);
      await this.kv.expire(key, 3_700);
    }
    return allowed;
  }

  // ===== 验证码错误计数（spec FR-003 / data-model V-06） =====
  // 返回 true 表示已触发锁定（错误次数达到上限）
  async checkAndIncrVerifyErrors(phone: string): Promise<boolean> {
    const key = `sms:errors:${phone}`;
    const count = await this.kv.incr(key);
    await this.kv.expire(key, config.smsLockMinutes * 60);
    return count >= config.smsMaxVerifyErrors;
  }

  async resetVerifyErrors(phone: string): Promise<void> {
    await this.kv.del(`sms:errors:${phone}`);
  }

  // ===== 密码错误计数与账号锁定（spec FR-009 / data-model V-05） =====
  // 返回 true 表示已达到锁定阈值
  async checkAndIncrPasswordErrors(phone: string): Promise<boolean> {
    const key = `pwd:errors:${phone}`;
    const count = await this.kv.incr(key);
    await this.kv.expire(key, config.accountLockMinutes * 60);
    return count >= config.passwordMaxErrors;
  }

  async resetPasswordErrors(phone: string): Promise<void> {
    await this.kv.del(`pwd:errors:${phone}`);
  }

  async isVerifyLocked(phone: string): Promise<boolean> {
    const count = Number((await this.kv.get(`sms:errors:${phone}`)) ?? '0');
    return count >= config.smsMaxVerifyErrors;
  }

  async isPasswordLocked(phone: string): Promise<boolean> {
    const count = Number((await this.kv.get(`pwd:errors:${phone}`)) ?? '0');
    return count >= config.passwordMaxErrors;
  }

  // ===== 危险字符检测（spec FR-007 / data-model V-10） =====
  // 使用 validator 库检测 SQL 注入 / XSS 常见载荷
  isMalicious(value: string): boolean {
    if (typeof value !== 'string') return true;
    if (!validator.isLength(value, { min: 1, max: 1024 })) return true;
    const sqlPatterns = [
      /('|")\s*OR\s+('|")/i, // ' OR '
      /\bOR\s+1\s*=\s*1\b/i, // OR 1=1
      /\b(?:SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b/i, // SQL 关键字
      /;\s*(?:DROP|DELETE|UPDATE)\b/i, // ; DROP TABLE
      /--\s*$|#\s*$/, // 行尾 SQL 注释
      /('|")\s*(?:AND|OR)\s+('|")\s*[^'"]*\s*=\s*/i // 'x' AND 'y'='z
    ];
    const xssPatterns = [
      /<script[\s>]/i,
      /<img[^>]+onerror=/i,
      /javascript:/i,
      /on(load|error|click|focus|blur)\s*=/i,
      /<[a-z][^>]*\sstyle\s*=/i
    ];
    return sqlPatterns.some((p) => p.test(value)) || xssPatterns.some((p) => p.test(value));
  }
}
