/**
 * 登录表单校验 Schema（T028）
 * 复用 packages/shared-schemas 的 phone/code 规则，错误码映射到用户可读文案。
 * 对齐 contracts §6 与 spec FR-001~FR-004。
 */
import { z } from 'zod';
import { loginPayloadSchema, sendSmsSchema } from '@spec/shared-schemas';

/** 错误码 → 用户可读文案（与 contracts §0 message 一致） */
export const errorMessageMap: Record<number, string> = {
  10001: '请输入正确的 11 位手机号',
  10002: '获取验证码过于频繁，请 60 秒后再试',
  10003: '验证码已过期，请重新获取',
  10004: '验证码错误，请重新输入',
  10005: '错误次数过多，请 10 分钟后重试',
  10006: '密码错误，请重试',
  10007: '密码错误次数过多，账号已临时锁定，请 30 分钟后重试或找回密码',
  10008: '此项为必填项',
  10009: '操作过于频繁，请稍后重试',
  10010: '请求包含非法参数，请检查输入内容',
  10011: '登录状态已过期，请重新登录',
  10012: '登录凭证无效，请重新登录'
};

/** 前端实时校验（spec P2：错误提示 ≤200ms，纯本地不请求网络） */
export const loginFormSchema = z.object({
  phone: z
    .string()
    .min(1, errorMessageMap[10008])
    .regex(/^1[3-9]\d{9}$/, errorMessageMap[10001]),
  code: z
    .string()
    .min(1, errorMessageMap[10008])
    .regex(/^\d{6}$/, errorMessageMap[10004])
    .refine((v) => !/^(\d)\1{5}$/.test(v) && !['123456', '654321'].includes(v), errorMessageMap[10004]),
  password: z
    .string()
    .min(1, errorMessageMap[10008])
    .min(8, '密码长度至少 8 位')
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export { loginPayloadSchema, sendSmsSchema };
