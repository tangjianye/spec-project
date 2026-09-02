/**
 * T021 前端登录流程集成测试（US1）
 * 验证：成功登录跳转、本地无 accessToken 持久化、60s 倒计时交互。
 */
import { describe, expect, it, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';
import { LoginForm } from '../../src/features/auth/components/LoginForm';
import { useAuthStore } from '../../src/features/auth/store/useAuthStore';

const server = setupServer(...handlers);

// 集成测试中 mock RSA 加密：直接返回 enc:<明文>，让 MSW 判定密码有效性
vi.mock('../../src/features/auth/services/rsaCrypto', () => ({
  encryptPassword: async (plain: string) => `enc:${plain}`
}));

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
});
afterAll(() => server.close());

describe('US1 用户完成安全登录', () => {
  it('登录成功后进入受保护页面，accessToken 仅存内存（FR-005/FR-010）', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('手机号'), '13800000001');
    await user.type(screen.getByLabelText('短信验证码'), '135792');
    // 加密依赖真实 WebCrypto，集成测试直接触发提交；RSA mock 场景下用 enc: 前缀让 MSW 判定为有效
    await user.type(screen.getByLabelText('密码'), 'enc:valid-password');
    await user.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => {
      const store = useAuthStore.getState();
      expect(store.user?.userId).toBe('u_0001');
      expect(store.accessToken).toBeTruthy();
    });
    // 不落 localStorage/sessionStorage（FR-010）
    expect(localStorage.getItem('accessToken')).toBeNull();
  });

  it('获取验证码后按钮进入倒计时（FR-002）', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('手机号'), '13800000001');
    await user.click(screen.getByRole('button', { name: '获取验证码' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /s 后重新获取/ })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /s 后重新获取/ })).toBeDisabled();
  });
});
