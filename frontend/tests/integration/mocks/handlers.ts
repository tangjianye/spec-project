/**
 * MSW mock handlers（T021/T035 前端集成测试用）
 * 模拟 contracts §1~§4 后端行为，覆盖成功与错误分支。
 */
import { http, HttpResponse } from 'msw';

const FIXED_CODE = '135792';

interface Envelope {
  code: number;
  message: string;
  data: unknown;
  errors: Array<{ field: string; message: string }>;
  requestId: string;
}

function envelope(code: number, message: string, data: unknown = null): Envelope {
  return { code, message, data, errors: [], requestId: `req_${Date.now()}` };
}

export const handlers = [
  http.post('/api/v1/auth/send-sms', async ({ request }) => {
    const body = (await request.json()) as { phone: string };
    if (!/^1[3-9]\d{9}$/.test(body.phone)) {
      return HttpResponse.json(envelope(10001, '请输入正确的 11 位手机号'), { status: 400 });
    }
    return HttpResponse.json(
      envelope(0, 'ok', {
        sentAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        cooldownSeconds: 60
      })
    );
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { phone: string; code: string; encryptedPassword: string };
    if (body.code !== FIXED_CODE) {
      return HttpResponse.json(envelope(10004, '验证码错误，请重新输入'), { status: 400 });
    }
    if (body.phone === '13800000099') {
      // 未注册：与密码错误一致（防枚举）
      return HttpResponse.json(envelope(10006, '密码错误，请重试'), { status: 400 });
    }
    if (!body.encryptedPassword.includes('valid')) {
      return HttpResponse.json(envelope(10006, '密码错误，请重试'), { status: 400 });
    }
    return HttpResponse.json(
      envelope(0, 'ok', {
        accessToken: 'mock-access-token',
        accessTokenExpiresAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
        user: {
          userId: 'u_0001',
          phoneMasked: `${body.phone.slice(0, 3)}****${body.phone.slice(-4)}`,
          nickname: '测试用户',
          avatarUrl: ''
        },
        deviceSessionId: 'mock-device'
      }),
      { headers: { 'Set-Cookie': 'refresh_token=mock-refresh; HttpOnly; Secure; SameSite=Lax; Max-Age=604800' } }
    );
  }),

  http.post('/api/v1/auth/refresh', async () => {
    return HttpResponse.json(
      envelope(0, 'ok', {
        accessToken: 'mock-access-token-refreshed',
        accessTokenExpiresAt: new Date(Date.now() + 2 * 3600_000).toISOString()
      })
    );
  }),

  http.get('/api/v1/auth/public-key', async () => {
    return HttpResponse.json(
      envelope(0, 'ok', {
        kid: 'rsa-test',
        pem: `-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKtest\n-----END PUBLIC KEY-----`
      })
    );
  })
];
