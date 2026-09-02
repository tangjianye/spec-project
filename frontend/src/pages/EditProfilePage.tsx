import { Link } from 'react-router-dom';
import { ProfileForm } from '../features/profile/components/ProfileForm';

export default function EditProfilePage() {
  return (
    <main className="profile-page">
      <Link to="/dashboard" className="back-link">← 返回</Link>
      <header><h1>编辑个人资料</h1><p>更新你在产品中展示的基础信息；账号安全信息由独立设置管理。</p></header>
      <ProfileForm />
    </main>
  );
}
