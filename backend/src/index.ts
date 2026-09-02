/**
 * 后端服务入口（T003 交付点）
 */
import { createApp } from './app.js';
import { config } from './config/env.js';

const app = createApp();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[auth] backend listening on http://localhost:${config.port} (store: ${config.useInMemoryStore ? 'memory' : 'redis'})`);
});
