import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function login(page: Page, phone = '13800000004'): Promise<string> {
  await page.goto('/login');
  await page.getByLabel('手机号').fill(phone);
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByLabel('短信验证码').fill('135792');
  await page.getByLabel('密码').fill('Password123!');
  const loginResponse = page.waitForResponse((response) => response.url().includes('/api/v1/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: '登 录' }).click();
  const body = await (await loginResponse).json() as { data: { accessToken: string } };
  await expect(page).toHaveURL(/\/dashboard/);
  return body.data.accessToken;
}

test.describe('用户资料编辑', () => {
  test('编辑保存、未保存提醒和 WCAG 核心检查', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: '编辑资料' }).click();
    await page.getByLabel(/昵称/).fill('端到端用户');
    const refreshDialog = page.waitForEvent('dialog');
    const cancelledReload = page.reload({ timeout: 2_000 }).catch(() => null);
    const dialog = await refreshDialog;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await cancelledReload;
    await page.getByLabel(/昵称/).fill('端到端用户');
    page.once('dialog', async (dialog) => { expect(dialog.message()).toContain('尚未保存'); await dialog.dismiss(); });
    await page.getByRole('link', { name: '返回' }).click();
    await expect(page).toHaveURL(/\/profile\/edit/);
    await page.getByRole('button', { name: '保存资料' }).click();
    await expect(page.getByRole('status')).toContainText('已保存');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });

  test('两个窗口使用同一版本保存时拒绝后提交者且返回最新版', async ({ page, context }) => {
    const token = await login(page, '13800000006');
    const secondWindow = await context.newPage();
    await secondWindow.goto('/login');
    await secondWindow.waitForLoadState('networkidle');
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const [firstResponse, secondResponse] = await Promise.all([
      page.request.get('http://localhost:5173/api/v1/profile', { headers }),
      secondWindow.request.get('http://localhost:5173/api/v1/profile', { headers })
    ]);
    const firstSnapshot = await firstResponse.json();
    const secondSnapshot = await secondResponse.json();
    const payload = (snapshot: typeof firstSnapshot, nickname: string) => ({
      expectedVersion: snapshot.data.version,
      nickname,
      bio: snapshot.data.bio,
      gender: snapshot.data.gender,
      birthDate: snapshot.data.birthDate,
      avatarImageId: snapshot.data.avatarImageId
    });
    const firstSave = await page.request.patch('http://localhost:5173/api/v1/profile', { headers, data: payload(firstSnapshot, '窗口一资料') });
    const staleSave = await secondWindow.request.patch('http://localhost:5173/api/v1/profile', { headers, data: payload(secondSnapshot, '窗口二资料') });
    expect(firstSave.status()).toBe(200);
    expect(staleSave.status()).toBe(409);
    expect((await staleSave.json()).data.currentProfile.nickname).toBe('窗口一资料');
    await secondWindow.close();
  });
});
