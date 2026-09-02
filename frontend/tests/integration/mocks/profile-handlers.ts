import { http, HttpResponse } from 'msw';

export const defaultProfile = {
  userId: 'u_0001',
  nickname: '测试用户',
  bio: null,
  gender: null,
  birthDate: null,
  avatarImageId: null,
  avatarUrl: '',
  version: 1,
  updatedAt: '2026-09-02T00:00:00.000Z'
};

function envelope(data: unknown) {
  return { code: 0, message: 'ok', data, requestId: 'req_profile_mock' };
}

export const profileHandlers = [
  http.get('/api/v1/profile', () => HttpResponse.json(envelope(defaultProfile))),
  http.patch('/api/v1/profile', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      envelope({ ...defaultProfile, ...body, version: Number(body.expectedVersion) + 1, updatedAt: new Date().toISOString() })
    );
  })
];
