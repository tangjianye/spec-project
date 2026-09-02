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
  TOKEN_INVALID: 10012,
  PROFILE_VALIDATION: 20001,
  PROFILE_CONFLICT: 20002,
  AVATAR_TYPE: 20003,
  AVATAR_TOO_LARGE: 20004,
  AVATAR_CORRUPT: 20005,
  AVATAR_UNAVAILABLE: 20006
} as const;

export const ProfileErrorCode = {
  VALIDATION: ErrorCode.PROFILE_VALIDATION,
  CONFLICT: ErrorCode.PROFILE_CONFLICT,
  AVATAR_TYPE: ErrorCode.AVATAR_TYPE,
  AVATAR_TOO_LARGE: ErrorCode.AVATAR_TOO_LARGE,
  AVATAR_CORRUPT: ErrorCode.AVATAR_CORRUPT,
  AVATAR_UNAVAILABLE: ErrorCode.AVATAR_UNAVAILABLE
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

export const profileGenderSchema = z.enum(['female', 'male', 'other', 'undisclosed']).nullable();

export const nicknameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(2).max(30).refine((value) => /\S/u.test(value)));

export const bioSchema = z
  .string()
  .max(200)
  .transform((value) => value.trim() || null)
  .nullable();

const plainDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const birthDateSchema = z
  .string()
  .regex(plainDatePattern)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  })
  .refine((value) => value <= new Date().toISOString().slice(0, 10))
  .nullable();

export const profileImageIdSchema = z.string().min(1).max(128).nullable();

export const profileSchema = z.object({
  userId: z.string().min(1),
  nickname: nicknameSchema,
  bio: bioSchema,
  gender: profileGenderSchema,
  birthDate: birthDateSchema,
  avatarImageId: profileImageIdSchema,
  avatarUrl: z.string(),
  version: z.number().int().positive(),
  updatedAt: z.string().datetime()
});

export const profileUpdateSchema = z.object({
  expectedVersion: z.number().int().positive(),
  nickname: nicknameSchema,
  bio: bioSchema,
  gender: profileGenderSchema,
  birthDate: birthDateSchema,
  avatarImageId: profileImageIdSchema
});

export type ProfileGender = z.infer<typeof profileGenderSchema>;
export type UserProfile = z.infer<typeof profileSchema>;
export type ProfileUpdatePayload = z.input<typeof profileUpdateSchema>;
export type NormalizedProfileUpdate = z.output<typeof profileUpdateSchema>;
