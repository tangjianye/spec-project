import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('手机号').fill('13800000004');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByLabel('短信验证码').fill('135792');
  await page.getByLabel('密码').fill('Password123!');
  await page.getByRole('button', { name: '登 录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('用户资料编辑', () => {
  test('编辑保存、未保存提醒和 WCAG 核心检查', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: '编辑资料' }).click();
    await page.getByLabel(/昵称/).fill('端到端用户');
    page.once('dialog', async (dialog) => { expect(dialog.message()).toContain('尚未保存'); await dialog.dismiss(); });
    await page.getByRole('link', { name: '返回' }).click();
    await expect(page).toHaveURL(/\/profile\/edit/);
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByRole('status')).toContainText('已保存');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
});
