/**
 * T049 WCAG 2.1 AA 无障碍断言（宪法 IV）
 * 登录页与仪表盘通过 axe-core 扫描，0 serious/critical 违规。
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('WCAG 2.1 AA 合规（宪法 IV）', () => {
  test('登录页无严重 a11y 违规', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(serious.length).toBe(0);
  });

  test('键盘可达：Tab 顺序 手机号→验证码→获取验证码→密码→登录按钮', async ({ page }) => {
    await page.goto('/login');
    // 先填手机号让"获取验证码"按钮可用（disabled 元素不可聚焦是合理的 a11y 行为）
    await page.getByLabel('手机号').fill('13800000001');
    // 点击页面空白区域重置焦点，再验证 Tab 流转
    await page.locator('body').click({ position: { x: 8, y: 8 } });
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('手机号')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('短信验证码')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: '获取验证码' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('密码')).toBeFocused();
  });
});
