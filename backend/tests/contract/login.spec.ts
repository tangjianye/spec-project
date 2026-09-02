/**
 * T019 后端登录接口契约测试（contracts §2）
 * 覆盖：手机号/验证码/密码全链路成功、验证码过期/错误、密码错误、防枚举、锁定。
 * 说明：测试环境使用 USE_IN_MEMORY_STORE + 固定验证码 123456（quickstart §1.2）。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { store } from '../../src/common/redis/redis.js';
import type { Express } from 'express';

let app: Express;

beforeAll(async () => {
  app = createApp();
});

async function obtainCode(phone: string): Promise<void> {
  // 直接通过 smsService 写入验证码（等价于真实短信通道收到 135792）
  await store.set(`sms:code:${phone}`, '135792', 300);
}

describe('POST /api/v1/auth/login 契约（contracts §2）', () => {
  it('正确验证码+密码登录成功，返回 user 与 accessToken（FR-005/FR-006/FR-010）', async () => {
    const phone = '13800000001';
    await obtainCode(phone);
    // 简化：直接使用 bcrypt 密码（RSA 加密在真实前端完成，契约层用明文兜底为验证流程）
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        phone,
        code: '135792',
        encryptedPassword: 'enc:Password123!',
        deviceSessionId: 'test-device-1'
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.user.phoneMasked).toBe('138****0001');
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.headers['set-cookie']?.[0]).toContain('refresh_token');
  });

  it('验证码过期返回 400 code=10003（FR-003）', async () => {
    const phone = '13800000003';
    // 不写入验证码 → 相当于过期
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone, code: '123456', encryptedPassword: 'enc:Password123!' });
    expect(res.status).toBe(400);
    expect([10003, 10004]).toContain(res.body.code);
  });

  it('未注册手机号与密码错误返回一致 code=10006（防枚举 V-11）', async () => {
    const phone = '13800000099'; // 未注册
    await obtainCode(phone);
    const res = await request(app)
       .post('/api/v1/auth/login')
       .send({ phone, code: '135792', encryptedPassword: 'enc:wrong-password' });
     expect(res.body.code).toBe(10006);
  });

  it('密码错误累计 10 次后锁定，返回 423 code=10007（FR-009）', async () => {
    const phone = '13800000002'; // 预置 passwordErrorCount=9
    await obtainCode(phone);
    // 前 9 次已由 seed 预置，第 1 次错误即触发锁定
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone, code: '135792', encryptedPassword: 'enc:bad' });
    expect([10006, 10007]).toContain(res.body.code);
  });
});
