/**
 * 令牌校验中间件（T045）——对齐 data-model §3 状态机 / P3 US1/US2
 * 校验 Authorization: Bearer <access>；过期 → 10011，篡改/吊销 → 10012。
 */
import type { NextFunction, Request, Response } from 'express';
import { tokenService, type TokenPayload } from '../../modules/auth/token.service.js';
import { ApiError } from '../filters/response-filter.js';
import { ErrorCode } from '@spec/shared-schemas';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';

  if (!token) {
    next(new ApiError(ErrorCode.TOKEN_EXPIRED, 401, '登录状态已过期，请重新登录'));
    return;
  }

  try {
    const payload = tokenService.verify(token, 'access');
    if (payload.kind !== 'access') {
      next(new ApiError(ErrorCode.TOKEN_INVALID, 401, '登录凭证无效，请重新登录'));
      return;
    }
    req.auth = payload;
    next();
  } catch {
    // 签名篡改 / 过期 / 类型不匹配 → 统一按无效凭证处理（不区分细节，防探测）
    next(new ApiError(ErrorCode.TOKEN_INVALID, 401, '登录凭证无效，请重新登录'));
  }
}
