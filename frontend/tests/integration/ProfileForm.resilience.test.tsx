import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { ProfileForm } from '../../src/features/profile/components/ProfileForm';
import { defaultProfile, profileHandlers } from './mocks/profile-handlers';

const server = setupServer(...profileHandlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ProfileForm resilience', () => {
  it('shows an explicit reload action for version conflicts and keeps the draft', async () => {
    server.use(http.patch('/api/v1/profile', () => HttpResponse.json({ code: 20002, message: '资料已在其他位置更新，请加载最新内容后重试', errors: [], data: { currentProfile: { ...defaultProfile, version: 2 } }, requestId: 'conflict' }, { status: 409 })));
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileForm /></MemoryRouter>);
    const nickname = await screen.findByLabelText(/昵称/);
    await user.clear(nickname);
    await user.type(nickname, '本地草稿');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    expect(await screen.findByRole('button', { name: '加载最新资料' })).toBeInTheDocument();
    expect(nickname).toHaveValue('本地草稿');
  });
});
