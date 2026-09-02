/**
 * 前后端共用校验 Schema（T008）
 * 对齐 contracts/auth-endpoints.md §6 与 spec FR-001~FR-004。
 * 前端用于即时校验提示；后端用于 DTO 入参校验，一处改动全链路生效。
 */
import { z } from 'zod';

/** 错误码常量：与 contracts §0 错误码矩阵保持一致 */
export const ErrorCode = {
  INVALID_PHONE: 10001,
  SMS_COOLDOWN: 10002,
  CODE_EXPIRED: 10003,
  CODE_WRONG: 10004,
  CODE_TOO_MANY_ATTEMPTS: 10005,
  PASSWORD_WRONG: 10006,
  ACCOUNT_LOCKED: 10007,
  MISSING_FIELD: 10008,
  RATE_LIMIT: 10009,
  MALICIOUS_INPUT: 10010,
  TOKEN_EXPIRED: 10011,
  TOKEN_INVALID: 10012
} as const;

/** 中国大陆 11 位手机号：1 开头，第二位 3-9，其余 9 位数字（spec FR-001） */
export const phoneRegex = /^1[3-9]\d{9}$/;

export const phoneSchema = z
  .string()
  .regex(phoneRegex, String(ErrorCode.INVALID_PHONE));

/** 6 位验证码：必须 6 位数字，拒绝 6 个相同数字与连续递增/递减（spec FR-002/FR-003 弱码防御） */
export const weakCodePatterns = [
  /^(\d)\1{5}$/, // 000000 / 111111 ...
  '123456',
  '654321',
  '234567',
  '765432',
  '345678',
  '876543'
];

export const codeSchema = z
  .string()
  .regex(/^\d{6}$/, String(ErrorCode.CODE_WRONG))
  .refine((v) => !weakCodePatterns.some((p) => (typeof p === 'string' ? v === p : p.test(v))), {
    message: String(ErrorCode.CODE_WRONG)
  });

export const sendSmsSchema = z.object({
  phone: z.string().regex(phoneRegex, String(ErrorCode.INVALID_PHONE)),
  scenario: z.literal('LOGIN')
});

export const loginPayloadSchema = z.object({
  phone: z.string().regex(phoneRegex, String(ErrorCode.INVALID_PHONE)),
  code: z.string().regex(/^\d{6}$/, String(ErrorCode.CODE_WRONG)),
  encryptedPassword: z.string().min(1, String(ErrorCode.MISSING_FIELD)),
  deviceSessionId: z.string().optional()
});

export type SendSmsPayload = z.infer<typeof sendSmsSchema>;
export type LoginPayload = z.infer<typeof loginPayloadSchema>;
