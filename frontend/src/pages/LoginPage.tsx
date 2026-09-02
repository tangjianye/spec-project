import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoginForm } from '../features/auth/components/LoginForm';

export default function LoginPage() {
  const [params, setParams] = useSearchParams();
  const expired = params.get('expired') === '1';

  useEffect(() => {
    if (expired) {
      // 展示一次提示后清理 URL 参数
      setParams({}, { replace: true });
    }
  }, [expired, setParams]);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">欢迎回来</h1>
        <p className="auth-subtitle">使用手机号验证码 + 密码安全登录</p>
        {expired && (
          <div className="global-error" role="alert">
            登录状态已过期，请重新登录
          </div>
        )}
        <LoginForm />
      </section>
    </main>
  );
}
