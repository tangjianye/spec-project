import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { ProfileForm } from '../../src/features/profile/components/ProfileForm';
import { profileHandlers } from './mocks/profile-handlers';
import { useAuthStore } from '../../src/features/auth/store/useAuthStore';

const server = setupServer(...profileHandlers);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
});
afterAll(() => server.close());

describe('ProfileForm', () => {
  it('loads, saves, and updates the authenticated user summary', async () => {
    useAuthStore.getState().setAuth({ userId: 'u_0001', phoneMasked: '138****0001', nickname: '测试用户', avatarUrl: '' }, 'token', '2099-01-01T00:00:00Z');
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileForm /></MemoryRouter>);
    const nickname = await screen.findByLabelText(/昵称/);
    expect(screen.getByRole('button', { name: '保存资料' })).toBeDisabled();
    await user.clear(nickname);
    await user.type(nickname, '新昵称🙂');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    await screen.findByText('个人资料已保存');
    await waitFor(() => expect(useAuthStore.getState().user?.nickname).toBe('新昵称🙂'));
  });

  it('keeps invalid values and shows field errors', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileForm /></MemoryRouter>);
    const nickname = await screen.findByLabelText(/昵称/);
    await user.clear(nickname);
    await user.type(nickname, ' ');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    expect(await screen.findByText(/昵称需为 2 至 30/)).toBeInTheDocument();
    expect(nickname).toHaveValue(' ');
  });
});
