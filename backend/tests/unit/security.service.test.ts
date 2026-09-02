/**
 * T053 后端安全策略引擎单测（100% 覆盖率要求）
 */
import { describe, expect, it } from 'vitest';
import { SecurityService } from '../../src/modules/auth/security.service.js';
import { InMemoryStore } from './helpers/in-memory-store.js';

describe('SecurityService（FR-003/FR-008/FR-009）', () => {
  it('IP 频控：达到阈值后拒绝', async () => {
    const kv = new InMemoryStore();
    const svc = new SecurityService(kv as never);
    const ip = '1.2.3.4';
    let allowedCount = 0;
    for (let i = 0; i < 25; i++) {
      if (await svc.checkRateLimit('ip', ip)) allowedCount++;
    }
    expect(allowedCount).toBe(20); // config.ipRateLimitPerMinute = 20
  });

  it('手机号频控：1 小时 10 次上限', async () => {
    const kv = new InMemoryStore();
    const svc = new SecurityService(kv as never);
    const phone = '13800000001';
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (await svc.checkRateLimit('phone', phone)) allowed++;
    }
    expect(allowed).toBe(10);
  });

  it('验证码错误计数达 5 次触发锁定（FR-003）', async () => {
    const kv = new InMemoryStore();
    const svc = new SecurityService(kv as never);
    let lockedAt = 0;
    for (let i = 1; i <= 5; i++) {
      if (await svc.checkAndIncrVerifyErrors('13800000001')) lockedAt = i;
    }
    expect(lockedAt).toBe(5);
    expect(await svc.isVerifyLocked('13800000001')).toBe(true);
  });

  it('密码错误计数达 10 次触发锁定（FR-009）', async () => {
    const kv = new InMemoryStore();
    const svc = new SecurityService(kv as never);
    let lockedAt = 0;
    for (let i = 1; i <= 10; i++) {
      if (await svc.checkAndIncrPasswordErrors('13800000001')) lockedAt = i;
    }
    expect(lockedAt).toBe(10);
    expect(await svc.isPasswordLocked('13800000001')).toBe(true);
  });

  it('危险字符检测：SQLi / XSS / 合法值（FR-007）', () => {
    const kv = new InMemoryStore();
    const svc = new SecurityService(kv as never);
    expect(svc.isMalicious("1' OR '1'='1")).toBe(true);
    expect(svc.isMalicious('<script>alert(1)</script>')).toBe(true);
    expect(svc.isMalicious('<img src=x onerror=alert(1)>')).toBe(true);
    expect(svc.isMalicious('13800000001')).toBe(false);
    expect(svc.isMalicious('hello world')).toBe(false);
  });
});
