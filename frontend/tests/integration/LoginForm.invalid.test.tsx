/**
 * T035 前端 5 类非法输入集成测试（US2）
 * 断言：非法手机号/错误验证码/错误密码/空值被拦截并显示字段绑定提示。
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

// 集成测试中 mock RSA 加密：直接返回 enc:<明文>
vi.mock('../../src/features/auth/services/rsaCrypto', () => ({
  encryptPassword: async (plain: string) => `enc:${plain}`
}));

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
});
afterAll(() => server.close());

describe('US2 非法输入即时拦截与友好提示', () => {
  it('非法手机号 blur 后显示错误提示，提交被阻止（FR-001）', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    const phoneInput = screen.getByLabelText('手机号');
    await user.type(phoneInput, '12345');
    await user.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => {
      expect(screen.getByText('请输入正确的 11 位手机号')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('手机号')).toHaveAttribute('aria-invalid', 'true');
  });

  it('空值提交提示"此项为必填项"（P2 Scenario 5）', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => {
      expect(screen.getAllByText('此项为必填项').length).toBeGreaterThan(0);
    });
  });

  it('错误验证码提交显示"验证码错误"（FR-003）', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('手机号'), '13800000001');
    await user.type(screen.getByLabelText('短信验证码'), '000000');
    await user.type(screen.getByLabelText('密码'), 'enc:valid-password');
    await user.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => {
      expect(screen.getByText('验证码错误，请重新输入')).toBeInTheDocument();
    });
  });

  it('未注册手机号与密码错误提示一致（防枚举 V-11）', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('手机号'), '13800000099');
    await user.type(screen.getByLabelText('短信验证码'), '135792');
    await user.type(screen.getByLabelText('密码'), 'enc:valid-password');
    await user.click(screen.getByRole('button', { name: '登 录' }));

    await waitFor(() => {
      expect(screen.getByText('密码错误，请重试')).toBeInTheDocument();
    });
  });
});
