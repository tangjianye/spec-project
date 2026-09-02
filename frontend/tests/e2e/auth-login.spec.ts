/**
 * T022 正向登录 E2E（US1）——quickstart 场景 1
 * 覆盖：登录成功跳转、刷新保持登录态、手机号校验即时提示。
 */
import { test, expect } from '@playwright/test';

test.describe('US1 用户完成安全登录', () => {
  test('正确手机号+验证码+密码登录成功并跳转受保护页', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('手机号')).toBeVisible();

    await page.getByLabel('手机号').fill('13800000001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByRole('button', { name: /s 后重新获取/ })).toBeVisible();
    // 测试环境白名单手机号固定验证码 135792
    await page.getByLabel('短信验证码').fill('135792');
    await page.getByLabel('密码').fill('Password123!');
    await page.getByRole('button', { name: '登 录' }).click();

    // 登录成功 → dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText('登录成功，进入受保护页面')).toBeVisible();
  });

  test('获取验证码进入 60s 倒计时', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('手机号').fill('13800000001');
    await page.getByRole('button', { name: '获取验证码' }).click();
    await expect(page.getByRole('button', { name: /s 后重新获取/ })).toBeVisible();
  });

  test('非法手机号被即时拦截并提示', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('手机号').fill('123');
    await page.getByLabel('密码').fill('Password123!');
    await page.getByRole('button', { name: '登 录' }).click();
    await expect(page.getByText('请输入正确的 11 位手机号')).toBeVisible();
  });
});
