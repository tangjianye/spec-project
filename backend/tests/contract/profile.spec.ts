import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { tokenService } from '../../src/modules/auth/token.service.js';

let app: Express;
let authorization: string;

beforeAll(() => {
  app = createApp();
  authorization = `Bearer ${tokenService.issuePair('u_0001', 'hash', 'profile-tests').accessToken}`;
});

describe('profile contract', () => {
  it('rejects unauthenticated reads and writes', async () => {
    expect((await request(app).get('/api/v1/profile')).status).toBe(401);
    expect((await request(app).patch('/api/v1/profile').send({})).status).toBe(401);
  });

  it('reads and atomically updates the current user profile', async () => {
    const before = await request(app).get('/api/v1/profile').set('Authorization', authorization);
    expect(before.status).toBe(200);
    const version = before.body.data.version as number;

    const updated = await request(app).patch('/api/v1/profile').set('Authorization', authorization).send({
      expectedVersion: version,
      nickname: ' 新昵称🙂 ',
      bio: '多语言简介',
      gender: 'undisclosed',
      birthDate: '1995-08-20',
      avatarImageId: null
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.nickname).toBe('新昵称🙂');
    expect(updated.body.data.version).toBe(version + 1);
  });

  it('returns field errors without mutation for invalid data', async () => {
    const before = await request(app).get('/api/v1/profile').set('Authorization', authorization);
    const result = await request(app).patch('/api/v1/profile').set('Authorization', authorization).send({
      expectedVersion: before.body.data.version,
      nickname: ' ',
      bio: 'kept out',
      gender: null,
      birthDate: '2999-01-01',
      avatarImageId: null
    });
    expect(result.status).toBe(400);
    const after = await request(app).get('/api/v1/profile').set('Authorization', authorization);
    expect(after.body.data.version).toBe(before.body.data.version);
    expect(after.body.data.bio).toBe(before.body.data.bio);
  });

  it('returns currentProfile on a stale version without overwriting', async () => {
    const current = await request(app).get('/api/v1/profile').set('Authorization', authorization);
    const result = await request(app).patch('/api/v1/profile').set('Authorization', authorization).send({
      expectedVersion: current.body.data.version - 1,
      nickname: '冲突昵称',
      bio: null,
      gender: null,
      birthDate: null,
      avatarImageId: null
    });
    expect(result.status).toBe(409);
    expect(result.body.code).toBe(20002);
    expect(result.body.data.currentProfile.version).toBe(current.body.data.version);
  });
});
