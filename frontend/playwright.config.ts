import { defineConfig, devices } from '@playwright/test';

/**
 * T022/T042/T049 E2E 配置
 * webServer 启动后端（内存存储）+ 前端 Vite，浏览器覆盖 Chromium。
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'cd ../backend && USE_IN_MEMORY_STORE=true NODE_ENV=test npx tsx src/index.ts',
      port: 3001,
      reuseExistingServer: true
    },
    {
      command: 'npx vite --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: true
    }
  ]
});
