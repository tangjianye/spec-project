/**
 * T042 令牌失效与非法访问 E2E（US3）——quickstart 场景 3
 * 登录成功后模拟 refresh_token 过期（/refresh 返回 401）→ 刷新页面被踢回登录页。
 */
import { test, expect } from '@playwright/test';

test.describe('US3 失效凭证拦截', () => {
  test('refresh_token 过期后刷新页面自动退出到登录页', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('手机号').fill('13800000002'); // 独立账号，避免与 US1 E2E 并行竞争验证码
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByRole('button', { name: /s 后重新获取/ })).toBeVisible();
    await page.getByLabel('短信验证码').fill('135792');
    await page.getByLabel('密码').fill('Password123!');
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 模拟 refresh_token 已过期：所有 /refresh 返回 401（P3 US1）
    await page.route('**/api/v1/auth/refresh', (route) => {
      void route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ code: 10011, message: '登录状态已过期，请重新登录', errors: [], requestId: 'e2e' })
      });
    });

    // 刷新页面 → 内存 token 丢失 → RequireAuth 尝试静默刷新失败 → 清态跳登录
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
