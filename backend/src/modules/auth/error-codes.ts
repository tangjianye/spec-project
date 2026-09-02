/**
 * 后端错误码与文案映射（T039）——对齐 contracts §0 错误码矩阵
 * 集中管理；"未注册手机号登录"与"密码错误"统一 10006 文案，防枚举（spec Edge Cases）。
 */
import { ErrorCode } from '@spec/shared-schemas';

export const errorMessages: Record<number, string> = {
  [ErrorCode.INVALID_PHONE]: '请输入正确的 11 位手机号',
  [ErrorCode.SMS_COOLDOWN]: '获取验证码过于频繁，请 60 秒后再试',
  [ErrorCode.CODE_EXPIRED]: '验证码已过期，请重新获取',
  [ErrorCode.CODE_WRONG]: '验证码错误，请重新输入',
  [ErrorCode.CODE_TOO_MANY_ATTEMPTS]: '错误次数过多，请 10 分钟后重试',
  [ErrorCode.PASSWORD_WRONG]: '密码错误，请重试',
  [ErrorCode.ACCOUNT_LOCKED]: '密码错误次数过多，账号已临时锁定，请 30 分钟后重试或找回密码',
  [ErrorCode.MISSING_FIELD]: '此项为必填项',
  [ErrorCode.RATE_LIMIT]: '操作过于频繁，请稍后重试',
  [ErrorCode.MALICIOUS_INPUT]: '请求包含非法参数，请检查输入内容',
  [ErrorCode.TOKEN_EXPIRED]: '登录状态已过期，请重新登录',
  [ErrorCode.TOKEN_INVALID]: '登录凭证无效，请重新登录'
};

export { ErrorCode };
