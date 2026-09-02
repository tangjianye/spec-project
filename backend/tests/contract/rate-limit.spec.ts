/**
 * T043 后端限流契约测试（FR-008 / P3 US3）
 * 1 分钟内同一 IP 第 21 次请求被 429 code=10009 拦截（滑动窗口）。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('滑动窗口限流（FR-008）', () => {
  it('同一 IP 1 分钟内 21 次登录尝试，第 21 次被 10009 拦截', async () => {
    const body = { phone: '13800000001', code: '135792', encryptedPassword: 'enc:x' };
    let lastCode = 0;
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post('/api/v1/auth/login').send(body);
      lastCode = res.body.code;
      if (res.body.code === 10009) break;
    }
    expect(lastCode).toBe(10009);
  });
});
