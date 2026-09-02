/**
 * 短信验证码服务（T023）——对齐 data-model §2 SmsCode 状态机
 * 生成 6 位验证码、Redis 5 分钟 TTL、60s 重发冷却（setNX）、新码作废旧码。
 */
import type { KVStore } from '../../common/redis/redis.js';
import { store } from '../../common/redis/redis.js';
import { config } from '../../config/env.js';

export class SmsService {
  constructor(private readonly kv: KVStore) {}

  private codeKey(phone: string): string {
    return `sms:code:${phone}`;
  }

  private cooldownKey(phone: string): string {
    return `sms:cooldown:${phone}`;
  }

  /** 生成 6 位数字验证码（拒绝弱码：6 个相同数字 / 连续递增递减） */
  generateCode(): string {
    let code = '';
    do {
      code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
    } while (
      /^(\d)\1{5}$/.test(code) ||
      ['123456', '654321', '234567', '765432'].includes(code)
    );
    return code;
  }

  /** 发送前置检查：60s 冷却（spec FR-002） */
  async isInCooldown(phone: string): Promise<boolean> {
    return (await this.kv.get(this.cooldownKey(phone))) !== null;
  }

  /** 发送验证码：冷却写入 + 验证码写入 5 分钟 TTL + 旧码作废（新码直接覆盖）
   *  测试/本地模式：白名单手机号使用固定验证码（quickstart §1.2），便于 E2E 与 QA 验收。
   */
  async send(phone: string): Promise<{ code: string; expiresAt: string; cooldownSeconds: number }> {
    const code =
      config.smsTestWhitelist.includes(phone) && process.env.NODE_ENV === 'test'
        ? config.smsTestFixedCode
        : this.generateCode();
    const now = Date.now();
    await this.kv.set(this.cooldownKey(phone), '1', config.smsCooldownSeconds);
    await this.kv.set(this.codeKey(phone), code, config.smsCodeTtlSeconds);
    return {
      code,
      expiresAt: new Date(now + config.smsCodeTtlSeconds * 1000).toISOString(),
      cooldownSeconds: config.smsCooldownSeconds
    };
  }

  /** 校验验证码：过期 / 错误 / 已作废判定（spec FR-003） */
  async verify(phone: string, inputCode: string): Promise<'OK' | 'EXPIRED' | 'WRONG'> {
    const stored = await this.kv.get(this.codeKey(phone));
    if (stored === null) return 'EXPIRED';
    if (stored !== inputCode) return 'WRONG';
    // 校验成功后立即作废（一次性使用）
    await this.kv.del(this.codeKey(phone));
    return 'OK';
  }
}

export const smsService = new SmsService(store);
