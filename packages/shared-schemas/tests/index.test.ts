/**
 * 共用 schema 单测（T053 / 覆盖率 100% 目标）
 */
import { describe, expect, it } from 'vitest';
import { phoneSchema, codeSchema, loginPayloadSchema, sendSmsSchema } from '../src/index.js';

describe('@spec/shared-schemas', () => {
  it('手机号规则（FR-001）', () => {
    expect(phoneSchema.safeParse('13800000001').success).toBe(true);
    expect(phoneSchema.safeParse('12800000001').success).toBe(false);
    expect(phoneSchema.safeParse('abc').success).toBe(false);
  });

  it('验证码弱码拒绝（FR-002/FR-003）', () => {
    expect(codeSchema.safeParse('135792').success).toBe(true);
    expect(codeSchema.safeParse('000000').success).toBe(false);
    expect(codeSchema.safeParse('654321').success).toBe(false);
    expect(codeSchema.safeParse('12345').success).toBe(false);
  });

  it('loginPayload 结构（FR-004）', () => {
    expect(
      loginPayloadSchema.safeParse({ phone: '13800000001', code: '123456', encryptedPassword: 'x' }).success
    ).toBe(true);
    expect(loginPayloadSchema.safeParse({ phone: '13800000001' }).success).toBe(false);
  });

  it('sendSms 仅 LOGIN 场景', () => {
    expect(sendSmsSchema.safeParse({ phone: '13800000001', scenario: 'LOGIN' }).success).toBe(true);
    expect(sendSmsSchema.safeParse({ phone: '13800000001', scenario: 'X' }).success).toBe(false);
  });
});
