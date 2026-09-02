import { describe, expect, it } from 'vitest';
import { validateProfile } from '../../src/features/profile/schemas/profileSchema';

describe('profile UI validation', () => {
  it('maps invalid fields to localized messages', () => {
    const result = validateProfile({ nickname: ' ', bio: 'x'.repeat(201), gender: null, birthDate: null, avatarImageId: null }, 1);
    expect(result.data).toBeNull();
    expect(result.errors.nickname).toContain('2 至 30');
    expect(result.errors.bio).toContain('200');
  });
});
