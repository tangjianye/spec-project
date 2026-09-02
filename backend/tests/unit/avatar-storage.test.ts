import { describe, expect, it } from 'vitest';
import { AvatarStorage } from '../../src/modules/user/avatar-storage.js';

describe('AvatarStorage', () => {
  it('isolates owners and supersedes the previous active avatar', () => {
    const storage = new AvatarStorage();
    const first = storage.create('u1', Buffer.from('one'), 'image/webp');
    const second = storage.create('u1', Buffer.from('two'), 'image/webp');
    expect(storage.findOwnedBindable('u2', first.imageId)).toBeNull();
    storage.activate('u1', first.imageId);
    storage.activate('u1', second.imageId);
    expect(first.status).toBe('superseded');
    expect(second.status).toBe('active');
  });

  it('deletes expired temporary records using the injected clock', () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new AvatarStorage(() => now);
    const temporary = storage.create('u1', Buffer.from('temporary-image'), 'image/webp');
    expect(storage.size).toBe(1);

    now = new Date('2026-01-02T00:00:00.001Z');
    expect(storage.cleanupExpired()).toBe(1);
    expect(storage.size).toBe(0);
    expect(storage.findOwnedBindable('u1', temporary.imageId)).toBeNull();
  });

  it('keeps active images after their former temporary expiry time', () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new AvatarStorage(() => now);
    const image = storage.create('u1', Buffer.from('active-image'), 'image/webp');
    storage.activate('u1', image.imageId);
    now = new Date('2026-01-03T00:00:00.000Z');
    expect(storage.cleanupExpired()).toBe(0);
    expect(storage.findOwnedBindable('u1', image.imageId)).toBe(image);
  });
});
