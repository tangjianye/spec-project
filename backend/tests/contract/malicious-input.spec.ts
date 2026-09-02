/**
 * T036 后端入参拦截契约测试（contracts §0 错误码矩阵 10010）
 * 恶意入参（SQL 注入 / XSS）在进入业务逻辑前被拦截。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('入参拦截（FR-007 / P3 US4）', () => {
  const maliciousBodies = [
    { phone: "1' OR '1'='1", code: '123456', encryptedPassword: 'x' },
    { phone: '13800000001', code: '123456', encryptedPassword: '<script>alert(1)</script>' },
    { phone: '13800000001', code: '123456', encryptedPassword: '<img src=x onerror=alert(1)>' },
    { phone: '13800000001; DROP TABLE users;', code: '123456', encryptedPassword: 'x' }
  ];

  it.each(maliciousBodies)('恶意入参被 400 code=10010 拦截', async (body) => {
    const res = await request(app).post('/api/v1/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(10010);
    expect(res.body.message).toContain('非法参数');
  });

  it('合法请求不受影响（正常入参通过输入守卫）', async () => {
    const res = await request(app).post('/api/v1/auth/send-sms').send({
      phone: '13800000001',
      scenario: 'LOGIN'
    });
    // 通过守卫后要么正常发送、要么因冷却被 429；但不该是 10010
    expect([0, 10002, 10009]).toContain(res.body.code);
  });
});
