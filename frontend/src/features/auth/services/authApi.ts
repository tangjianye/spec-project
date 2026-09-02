/**
 * 登录 API 封装（T033）——对接 contracts §1~§4
 * sendSms / login / logout；静默刷新由 http.ts 拦截器统一处理。
 */
import http, { parseApiError } from '../../../shared/services/http';
import { useAuthStore, type AuthUser } from '../store/useAuthStore';

export interface SendSmsResult {
  sentAt: string;
  expiresAt: string;
  cooldownSeconds: number;
}

export interface LoginResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: AuthUser;
  deviceSessionId: string;
}

/** 发送短信验证码（contracts §1） */
export async function sendSms(phone: string): Promise<SendSmsResult> {
  try {
    const res = await http.post<{ data: SendSmsResult }>('/auth/send-sms', {
      phone,
      scenario: 'LOGIN'
    });
    return res.data.data;
  } catch (error) {
    const api = parseApiError(error);
    throw new Error(api.message);
  }
}

/** 登录（contracts §2）：成功写入 Store 并返回结果 */
export async function login(payload: {
  phone: string;
  code: string;
  encryptedPassword: string;
  deviceSessionId: string;
}): Promise<LoginResult> {
  const res = await http.post<{ data: LoginResult }>('/auth/login', payload, { withCredentials: true });
  const result = res.data.data;
  useAuthStore.getState().setAuth(result.user, result.accessToken, result.accessTokenExpiresAt);
  return result;
}

/** 登出（contracts §4）：吊销当前设备令牌并清空本地态 */
export async function logout(allDevices = false): Promise<void> {
  try {
    await http.post<{ data: { loggedOutAt: string } }>(
      '/auth/logout',
      { allDevices },
      { withCredentials: true }
    );
  } finally {
    useAuthStore.getState().clearAuth();
  }
}

/** 静默刷新（供 RequireAuth 初始化时恢复登录态），成功返回 true */
export async function trySilentRefresh(): Promise<boolean> {
  try {
    const res = await http.post<{
      data: { accessToken: string; accessTokenExpiresAt: string };
    }>('/auth/refresh', {}, { withCredentials: true });
    const { accessToken, accessTokenExpiresAt } = res.data.data;
    useAuthStore.getState().setToken(accessToken, accessTokenExpiresAt);
    return true;
  } catch {
    return false;
  }
}
