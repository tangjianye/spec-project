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

  it('announces upload progress accessibly and disables file selection', () => {
    render(<AvatarField previewUrl="" nickname="用户" progress={42} disabled onChoose={() => undefined} />);
    expect(screen.getByRole('progressbar', { name: '头像上传进度' })).toHaveAttribute('value', '42');
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByLabelText('选择头像')).toBeDisabled();
  });
});
