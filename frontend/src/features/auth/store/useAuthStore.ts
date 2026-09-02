/**
 * 前端鉴权 Store（T016）——Zustand 全局登录态
 * 对齐 plan Technical Context：Access Token 仅存内存变量（严禁 localStorage/sessionStorage），
 * Refresh Token 由 HttpOnly Cookie 托管，前端不可读。
 */
import { create } from 'zustand';

export interface AuthUser {
  userId: string;
  phoneMasked: string;
  nickname: string;
  avatarUrl: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  setAuth: (user: AuthUser, token: string, expiresAt: string) => void;
  setToken: (token: string, expiresAt: string) => void;
  updateUserSummary: (summary: Pick<AuthUser, 'nickname' | 'avatarUrl'>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,

  /** 登录成功：写入 user + accessToken（仅内存） */
  setAuth: (user, token, expiresAt) => set({ user, accessToken: token, accessTokenExpiresAt: expiresAt }),

  /** 静默刷新成功：仅更新 accessToken */
  setToken: (token, expiresAt) => set({ accessToken: token, accessTokenExpiresAt: expiresAt }),

  updateUserSummary: (summary) =>
    set((state) => ({ user: state.user ? { ...state.user, ...summary } : null })),

  /** 登出 / 令牌失效：清空全部登录态 */
  clearAuth: () => set({ user: null, accessToken: null, accessTokenExpiresAt: null })
}));
