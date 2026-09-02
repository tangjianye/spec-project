import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

/**
 * T050 Storybook 测试 runner 配置：每个 story 渲染后执行 axe-core WCAG 2.1 AA 断言。
 * 依赖 @storybook/test-runner + axe-playwright，对齐宪法 IV。
 */
const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page, context) {
    // 跳过未渲染成功的 story，避免误报
    const storyContext = await getStoryContext(page, context);
    if (storyContext.parameters?.a11y?.disable) {
      return;
    }
    await checkA11y(page, '#storybook-root', {
      detailedReport: true,
      detailedReportOptions: { html: true },
      axeOptions: { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }
    });
  }
};

export default config;
