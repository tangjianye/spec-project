/**
 * T020 后端 Refresh 接口契约测试（contracts §3 / P3 US1）
 * 成功轮换令牌 + refresh_token 过期/无效返回 10011/10012。
 */
import { describe, expect, it, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { tokenService } from '../../src/modules/auth/token.service.js';
import type { Express } from 'express';

let app: Express;

beforeAll(() => {
  app = createApp();
});

async function loginGetRefreshCookie(): Promise<string> {
  // 先走登录拿 refresh_token cookie
  const res = await request(app).post('/api/v1/auth/login').send({
    phone: '13800000001',
    code: '123456',
    encryptedPassword: 'enc:Password123!'
  });
  // 若验证码未写入则先绕过：直接由 tokenService 签发 refresh 放入 cookie
  const setCookie = (res.headers['set-cookie'] as unknown as string[]) ?? [];
  const cookie = setCookie.find((c) => c.startsWith('refresh_token='));
  if (cookie) return cookie.split(';')[0];
  // 兜底：直接签发
  const pair = tokenService.issuePair('u_1', 'hash', 'd');
  return `refresh_token=${pair.refreshToken}`;
}

describe('POST /api/v1/auth/refresh 契约（contracts §3）', () => {
  it('有效 refresh_token 轮换成功，返回新 accessToken', async () => {
    const cookie = await loginGetRefreshCookie();
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('缺失 refresh_token 返回 401 code=10011（P3 US1）', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10011);
  });

  it('伪造 refresh_token 返回 401 code=10012（P3 US2）', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', 'refresh_token=forged.token.here')
      .send({});
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(10012);
  });
});
