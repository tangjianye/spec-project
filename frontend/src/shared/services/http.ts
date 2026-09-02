/**
 * 前端 HTTP 客户端（T015/T044）——对接 contracts §0 统一响应信封
 * 401 时单飞并发静默刷新 Access Token 并重放原请求；刷新失败清态跳登录。
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import { ErrorCode } from '@spec/shared-schemas';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

const http = axios.create({
  baseURL: '/api/v1',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' }
});

// 请求拦截：注入内存 Access Token（绝不读写 localStorage）
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<boolean> | null = null;

/** 静默刷新：单飞并发（T044），失败返回 false 由调用方清态 */
async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = axios
      .post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then((res) => {
        const body = res.data as ApiEnvelope<{ accessToken: string; accessTokenExpiresAt: string }>;
        useAuthStore.getState().setToken(body.data.accessToken, body.data.accessTokenExpiresAt);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// 响应拦截：401 → 静默刷新 → 重放；刷新失败 → 清态跳登录
http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status;
    const code = error.response?.data?.code;
    if (status === 401 && (code === ErrorCode.TOKEN_EXPIRED || code === ErrorCode.TOKEN_INVALID)) {
      const ok = await tryRefresh();
      if (ok && error.config) {
        // 重放原请求（携带新 token）
        const newToken = useAuthStore.getState().accessToken;
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return http.request(error.config);
      }
      useAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined') {
        window.location.assign('/login?expired=1');
      }
    }
    return Promise.reject(error);
  }
);

/** 统一解析 ApiError 为 { code, message, errors }，供表单字段级回填 */
export function parseApiError(error: unknown): {
  code: number;
  message: string;
  errors: Array<{ field: string; message: string }>;
} {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiEnvelope<unknown> | undefined;
    if (body && typeof body.code === 'number') {
      return {
        code: body.code,
        message: body.message,
        errors: (body as unknown as { errors: Array<{ field: string; message: string }> }).errors ?? []
      };
    }
  }
  return { code: -1, message: '网络异常，请检查网络连接', errors: [] };
}

export default http;
