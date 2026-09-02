import { describe, expect, it } from 'vitest';
import { UserRepository } from '../../src/modules/user/user.entity.js';

describe('versioned profile repository', () => {
  it('updates atomically and preserves account fields', () => {
    const repo = new UserRepository();
    repo.seed();
    const before = repo.findById('u_0001')!;
    const passwordHash = before.passwordHash;
    const result = repo.updateProfile('u_0001', { expectedVersion: 1, nickname: '用户🙂', bio: null, gender: null, birthDate: null, avatarImageId: null }, '');
    expect(result.status).toBe('updated');
    expect(repo.findById('u_0001')?.passwordHash).toBe(passwordHash);
    expect(repo.findById('u_0001')?.profileVersion).toBe(2);
  });

  it('returns conflict without partial mutation', () => {
    const repo = new UserRepository();
    repo.seed();
    const result = repo.updateProfile('u_0001', { expectedVersion: 99, nickname: '不会写入', bio: null, gender: null, birthDate: null, avatarImageId: null }, '');
    expect(result.status).toBe('conflict');
    expect(repo.findById('u_0001')?.nickname).toBe('用户一');
  });
});
