import { describe, expect, it, vi, afterEach } from 'vitest';
import { profileUpdateSchema } from '../src/index';

const valid = {
  expectedVersion: 1,
  nickname: '用户昵称',
  bio: null,
  gender: null,
  birthDate: null,
  avatarImageId: null
};

afterEach(() => {
  vi.useRealTimers();
});

describe('profileUpdateSchema', () => {
  it('trims fields and accepts Unicode and emoji', () => {
    const result = profileUpdateSchema.parse({ ...valid, nickname: '  用户🙂  ', bio: ' 简介🙂 ' });
    expect(result.nickname).toBe('用户🙂');
    expect(result.bio).toBe('简介🙂');
  });

  it('enforces nickname and bio limits', () => {
    expect(profileUpdateSchema.safeParse({ ...valid, nickname: 'a'.repeat(31) }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, nickname: '   ' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, bio: 'a'.repeat(201) }).success).toBe(false);
  });

  it('accepts nullable optional profile fields', () => {
    expect(profileUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a future birth date and invalid versions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
    expect(profileUpdateSchema.safeParse({ ...valid, birthDate: '2026-09-03' }).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ ...valid, expectedVersion: 0 }).success).toBe(false);
  });
});
