/**
 * Express 应用装配（T052 部分：helmet / CORS / 输入守卫 / 错误过滤器）
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { authRouter } from './modules/auth/auth.controller.js';
import { security } from './modules/auth/security.instance.js';
import { createInputGuard } from './common/filters/input-guard.js';
import { errorFilter } from './common/filters/response-filter.js';

export function createApp(): express.Express {
  const app = express();

  // 安全响应头（T052）：防点击劫持 + CSP frame-ancestors
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          frameAncestors: ["'none'"],
          defaultSrc: ["'self'"]
        }
      }
    })
  );

  // CORS：仅允许前端来源携带 Cookie（withCredentials）
  app.use(
    cors({
      origin: config.frontendOrigin,
      credentials: true
    })
  );

  app.use(express.json({ limit: '64kb' }));

  // 全局入参拦截（T038）：危险字符在进入业务前拦截
  app.use('/api/v1/auth', createInputGuard(security));

  app.use('/api/v1/auth', authRouter);

  app.use(errorFilter);

  return app;
}
