import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { tokenService } from '../../src/modules/auth/token.service.js';

let app: Express;
let authorization: string;

beforeAll(() => {
  app = createApp();
  authorization = `Bearer ${tokenService.issuePair('u_0001', 'hash', 'avatar-tests').accessToken}`;
});

describe('profile avatar contract', () => {
  it('uploads and activates a valid PNG', async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#2563eb' } }).png().toBuffer();
    const upload = await request(app).post('/api/v1/profile/avatar').set('Authorization', authorization).attach('avatar', png, { filename: 'avatar.png', contentType: 'image/png' });
    expect(upload.status).toBe(201);
    expect(upload.body.data.mediaType).toBe('image/webp');

    const current = await request(app).get('/api/v1/profile').set('Authorization', authorization);
    const saved = await request(app).patch('/api/v1/profile').set('Authorization', authorization).send({
      expectedVersion: current.body.data.version,
      nickname: current.body.data.nickname,
      bio: current.body.data.bio,
      gender: current.body.data.gender,
      birthDate: current.body.data.birthDate,
      avatarImageId: upload.body.data.imageId
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.avatarUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it('rejects corrupt and oversized files', async () => {
    const corrupt = await request(app).post('/api/v1/profile/avatar').set('Authorization', authorization).attach('avatar', Buffer.from('not-an-image'), { filename: 'avatar.png', contentType: 'image/png' });
    expect(corrupt.status).toBe(400);
    expect(corrupt.body.code).toBe(20005);

    const large = await request(app).post('/api/v1/profile/avatar').set('Authorization', authorization).attach('avatar', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' });
    expect(large.status).toBe(413);
  });
});
