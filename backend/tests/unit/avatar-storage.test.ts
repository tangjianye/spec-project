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
});
