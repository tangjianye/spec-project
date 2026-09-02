/**
 * T018 后端发送验证码接口契约测试（contracts §1）
 * 手机号正则 / 冷却 / 限流错误码 10001/10002/10009。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('POST /api/v1/auth/send-sms 契约（contracts §1）', () => {
  it('合法手机号返回 200 与 cooldownSeconds=60（FR-002）', async () => {
    const res = await request(app).post('/api/v1/auth/send-sms').send({
      phone: '13800000001',
      scenario: 'LOGIN'
    });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.cooldownSeconds).toBe(60);
    expect(res.body.data.expiresAt).toBeTruthy();
  });

  it('非法手机号返回 400 code=10001（FR-001）', async () => {
    const res = await request(app).post('/api/v1/auth/send-sms').send({
      phone: '12345',
      scenario: 'LOGIN'
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(10001);
  });

  it('60 秒内重复发送返回 429 code=10002（FR-002 冷却）', async () => {
    const phone = '13800000002';
    await request(app).post('/api/v1/auth/send-sms').send({ phone, scenario: 'LOGIN' });
    const res = await request(app).post('/api/v1/auth/send-sms').send({ phone, scenario: 'LOGIN' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe(10002);
  });
});
