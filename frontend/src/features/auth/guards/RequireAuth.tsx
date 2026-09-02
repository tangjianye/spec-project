/**
 * 路由守卫（T017/T048）——对齐 P3 US1/US2
 * 无 accessToken 时尝试静默刷新（HttpOnly Cookie 自动携带），失败则清态跳登录页。
 */
import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { trySilentRefresh } from '../services/authApi';

export function RequireAuth({ children }: { children: ReactElement }): ReactElement {
  const { user, accessToken } = useAuthStore();
  const location = useLocation();

  if (!user || !accessToken) {
    // 未登录：尝试用 refresh_token 静默恢复（避免刷新页面即掉线，对齐 SC-006）
    trySilentRefresh().then((ok) => {
      if (!ok) {
        useAuthStore.getState().clearAuth();
        window.location.assign('/login?expired=1');
      }
    });
    return <Navigate to="/login?expired=1" replace state={{ from: location }} />;
  }

  return children;
}
