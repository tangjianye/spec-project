/**
 * 后端入参拦截守卫（T038）——对齐 spec FR-007 / P3 US4
 * 在进入核心业务逻辑前拦截：危险字符（SQL 注入 / XSS）、超长参数。
 * 命中即 400 code 10010 + 写 MALICIOUS_INPUT_DETECTED 安全日志。
 */
import type { NextFunction, Request, Response } from 'express';
import { SecurityService } from '../../modules/auth/security.service.js';
import { securityLog } from '../logs/security-log.service.js';
import { ApiError } from '../filters/response-filter.js';
import { ErrorCode } from '@spec/shared-schemas';

export function createInputGuard(security: SecurityService) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const candidateValues = collectStringValues(req.body);
    const malicious = candidateValues.some((v) => security.isMalicious(v));

    if (malicious) {
      void securityLog.write(req, {
        eventType: 'MALICIOUS_INPUT_DETECTED',
        actorType: 'ANONYMOUS',
        actorRef: 'unknown',
        result: 'BLOCKED',
        details: { path: req.path, blocked: true }
      });
      next(
        new ApiError(ErrorCode.MALICIOUS_INPUT, 400, '请求包含非法参数，请检查输入内容', [
          { field: '_body', message: '请求包含非法参数，请检查输入内容' }
        ])
      );
      return;
    }
    next();
  };
}

/** 收集请求 body 中所有字符串值用于危险字符扫描（不落明文，仅检测） */
function collectStringValues(body: unknown, out: string[] = []): string[] {
  if (body === null || body === undefined) return out;
  if (typeof body === 'string') {
    out.push(body);
    return out;
  }
  if (Array.isArray(body)) {
    for (const item of body) collectStringValues(item, out);
    return out;
  }
  if (typeof body === 'object') {
    for (const value of Object.values(body as Record<string, unknown>)) {
      collectStringValues(value, out);
    }
  }
  return out;
}
