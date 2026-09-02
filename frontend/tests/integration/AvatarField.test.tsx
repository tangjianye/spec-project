import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AvatarField } from '../../src/features/profile/components/AvatarField';

describe('AvatarField', () => {
  it('passes a selected supported file to the upload flow', async () => {
    const onChoose = vi.fn();
    render(<AvatarField previewUrl="" nickname="用户" onChoose={onChoose} />);
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText('选择头像'), file);
    expect(onChoose).toHaveBeenCalledWith(file);
  });
});
