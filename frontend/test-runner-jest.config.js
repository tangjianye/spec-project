/* eslint-disable @typescript-eslint/no-var-requires */
// test-runner 要求该配置文件为 CommonJS（module.exports），故豁免 no-var-requires
const { getJestConfig } = require('@storybook/test-runner');

// 继承 test-runner 默认 Jest 配置
const testRunnerConfig = getJestConfig();

/**
 * T050 Storybook 测试 Jest 覆盖：
 * - watchman=false：受限环境（CI sandbox / 无 watchman 守护进程）下使用
 *   Node 原生文件监听，避免 jest 探测 watchman 失败导致测试中断。
 */
module.exports = {
  ...testRunnerConfig,
  watchman: false
};
