import { useAuthStore } from '../features/auth/store/useAuthStore';
import { logout } from '../features/auth/services/authApi';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <main className="dash-page">
      <header className="dash-header">
        <div className="user-info">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={`${user.nickname} 的头像`} width={40} height={40} className="avatar" />
          ) : (
            <span className="avatar avatar-fallback" aria-hidden="true">
              {user?.nickname?.slice(0, 1) ?? 'U'}
            </span>
          )}
          <div>
            <strong>{user?.nickname}</strong>
            <span className="phone-masked">{user?.phoneMasked}</span>
            <Link to="/profile/edit" className="profile-link">编辑资料</Link>
          </div>
        </div>
        <button type="button" className="logout-btn" onClick={() => void logout()}>
          退出登录
        </button>
      </header>
      <section aria-label="受保护内容">
        <h1>登录成功，进入受保护页面</h1>
        <p>当前会话：{user?.userId}</p>
      </section>
    </main>
  );
}
