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
  it('compares a version conflict and can restore the local draft on the latest baseline', async () => {
    server.use(http.patch('/api/v1/profile', () => HttpResponse.json({ code: 20002, message: '资料已在其他位置更新，请加载最新内容后重试', errors: [], data: { currentProfile: { ...defaultProfile, version: 2 } }, requestId: 'conflict' }, { status: 409 })));
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileForm /></MemoryRouter>);
    const nickname = await screen.findByLabelText(/昵称/);
    await user.clear(nickname);
    await user.type(nickname, '本地草稿');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    expect(await screen.findByRole('heading', { name: '比较资料冲突' })).toBeInTheDocument();
    expect(nickname).toHaveValue('本地草稿');
    await user.click(screen.getByRole('button', { name: '恢复本地草稿并继续' }));
    expect(nickname).toHaveValue('本地草稿');
    expect(screen.getByText(/已基于最新版恢复本地草稿/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存资料' })).toBeEnabled();
  });

  it('can discard a conflicted local draft and adopt the latest profile', async () => {
    server.use(http.patch('/api/v1/profile', () => HttpResponse.json({ code: 20002, message: '资料冲突', errors: [], data: { currentProfile: { ...defaultProfile, nickname: '远端昵称', version: 2 } }, requestId: 'conflict' }, { status: 409 })));
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileForm /></MemoryRouter>);
    const nickname = await screen.findByLabelText(/昵称/);
    await user.clear(nickname);
    await user.type(nickname, '要放弃的草稿');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    await user.click(await screen.findByRole('button', { name: '采用最新版并放弃草稿' }));
    expect(nickname).toHaveValue('远端昵称');
    expect(screen.getByRole('button', { name: '保存资料' })).toBeDisabled();
  });

  it('retains the draft after a server failure and succeeds when retried', async () => {
    let attempts = 0;
    server.use(http.patch('/api/v1/profile', async ({ request }) => {
      attempts += 1;
      if (attempts === 1) return HttpResponse.json({ code: 50000, message: '服务暂时不可用', errors: [], data: null, requestId: 'failed' }, { status: 500 });
      const body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ code: 0, message: 'ok', data: { ...defaultProfile, ...body, version: 2 }, requestId: 'retried' });
    }));
    const user = userEvent.setup();
    render(<MemoryRouter><ProfileForm /></MemoryRouter>);
    const nickname = await screen.findByLabelText(/昵称/);
    await user.clear(nickname);
    await user.type(nickname, '失败后保留');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('服务暂时不可用');
    expect(nickname).toHaveValue('失败后保留');
    await user.click(screen.getByRole('button', { name: '保存资料' }));
    expect(await screen.findByRole('status')).toHaveTextContent('个人资料已保存');
    expect(attempts).toBe(2);
  });
});
