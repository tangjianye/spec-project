import { expect, test, type Page } from '@playwright/test';

interface WebVitals { lcp: number; inp: number; cls: number }

async function installVitalObservers(page: Page) {
  await page.addInitScript(() => {
    const metrics = { lcp: 0, inp: 0, cls: 0 };
    Object.defineProperty(window, '__profileVitals', { value: metrics, writable: false });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries.at(-1);
      if (latest) metrics.lcp = latest.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) metrics.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    if (PerformanceObserver.supportedEntryTypes.includes('event')) {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.inp = Math.max(metrics.inp, entry.duration);
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
    }
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('手机号').fill('13800000005');
  await page.getByRole('button', { name: '获取验证码' }).click();
  await page.getByLabel('短信验证码').fill('135792');
  await page.getByLabel('密码').fill('Password123!');
  await page.getByRole('button', { name: '登 录' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test('资料页 Web Vitals 与保存反馈满足性能预算', async ({ page }) => {
  await installVitalObservers(page);
  await login(page);
  await page.getByRole('link', { name: '编辑资料' }).click();
  await expect(page.getByRole('heading', { name: '编辑个人资料' })).toBeVisible();
  await page.waitForTimeout(250);

  await page.getByLabel(/昵称/).fill(`性能用户${Date.now()}`);
  const saveStartedAt = Date.now();
  await page.getByRole('button', { name: '保存资料' }).click();
  await expect(page.getByRole('status')).toContainText('已保存');
  expect(Date.now() - saveStartedAt, '保存操作应在 2 秒内给出成功反馈').toBeLessThanOrEqual(2_000);

  const vitals = await page.evaluate(() => (window as Window & { __profileVitals: WebVitals }).__profileVitals);
  expect(vitals.lcp, 'LCP 应不超过 2.5 秒').toBeLessThanOrEqual(2_500);
  expect(vitals.inp, 'INP 应不超过 200 毫秒').toBeLessThanOrEqual(200);
  expect(vitals.cls, 'CLS 应不超过 0.1').toBeLessThanOrEqual(0.1);
});

declare global {
  interface Window { __profileVitals: WebVitals }
}
