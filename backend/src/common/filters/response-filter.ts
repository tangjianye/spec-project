import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/** 统一成功响应信封（contracts §0）：{ code, message, data, requestId } */
export function ok<T>(res: Response, data: T, requestId = randomUUID()): void {
  res.json({ code: 0, message: 'ok', data, requestId });
}

/** 统一业务错误信封（contracts §0）：{ code, message, errors, requestId } */
export class ApiError extends Error {
  constructor(
    public readonly code: number,
    public readonly httpStatus: number,
    message: string,
    public readonly errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorFilter(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();

  if (err instanceof ApiError) {
    res.status(err.httpStatus).json({
      code: err.code,
      message: err.message,
      errors: err.errors ?? [],
      requestId
    });
    return;
  }

  // 未知错误（5xx）：不暴露技术细节，仅返回通用文案 + requestId
  // eslint-disable-next-line no-console
  console.error('[unhandled-error]', requestId, err);
  res.status(500).json({
    code: 500,
    message: '服务暂不可用，请稍后重试',
    errors: [],
    requestId
  });
}
