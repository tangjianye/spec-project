/**
 * T053 登录 Schema 单测（业务逻辑 100% 覆盖率要求）
 */
import { describe, expect, it } from 'vitest';
import { loginFormSchema } from '../../src/features/auth/schemas/loginSchema';
import { phoneSchema, codeSchema, loginPayloadSchema, sendSmsSchema, ErrorCode } from '@spec/shared-schemas';

describe('shared-schemas / loginSchema 校验规则', () => {
  it('手机号：合法通过 / 非法拦截（FR-001）', () => {
    expect(phoneSchema.safeParse('13800000001').success).toBe(true);
    expect(phoneSchema.safeParse('12345').success).toBe(false);
    expect(phoneSchema.safeParse('12800000001').success).toBe(false);
    expect(phoneSchema.safeParse('1380000000a').success).toBe(false);
  });

  it('验证码：6 位数字 / 拒绝弱码（FR-002/FR-003）', () => {
    expect(codeSchema.safeParse('135792').success).toBe(true);
    expect(codeSchema.safeParse('000000').success).toBe(false); // 6 个相同数字
    expect(codeSchema.safeParse('654321').success).toBe(false); // 连续递减
    expect(codeSchema.safeParse('12345').success).toBe(false);
  });

  it('loginPayloadSchema 字段约束（FR-004）', () => {
    const ok = loginPayloadSchema.safeParse({
      phone: '13800000001',
      code: '135792',
      encryptedPassword: 'base64string'
    });
    expect(ok.success).toBe(true);
    const bad = loginPayloadSchema.safeParse({ phone: 'abc', code: '1', encryptedPassword: '' });
    expect(bad.success).toBe(false);
  });

  it('sendSmsSchema 仅接受 LOGIN 场景', () => {
    expect(sendSmsSchema.safeParse({ phone: '13800000001', scenario: 'LOGIN' }).success).toBe(true);
    expect(sendSmsSchema.safeParse({ phone: '13800000001', scenario: 'REGISTER' }).success).toBe(false);
  });

  it('前端 loginFormSchema 错误文案绑定错误码', () => {
    const result = loginFormSchema.safeParse({ phone: '123', code: '', password: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain('请输入正确的 11 位手机号');
      expect(messages).toContain('此项为必填项');
    }
  });

  it('错误码常量与 contracts §0 对齐', () => {
    expect(ErrorCode.INVALID_PHONE).toBe(10001);
    expect(ErrorCode.TOKEN_INVALID).toBe(10012);
  });
});
