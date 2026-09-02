import { AvatarField } from './AvatarField';
import { BirthdayField } from './BirthdayField';
import { GenderField } from './GenderField';
import { TextField } from './TextField';
import { useProfileForm } from '../hooks/useProfileForm';
import { useAuthStore } from '../../auth/store/useAuthStore';

export function ProfileForm() {
  const form = useProfileForm();
  const phoneMasked = useAuthStore((state) => state.user?.phoneMasked);
  if (form.status === 'loading') return <p aria-busy="true">正在加载个人资料…</p>;
  if (!form.profile) return <div role="alert"><p>{form.message}</p><button type="button" onClick={() => void form.load()}>重新加载</button></div>;

  return (
    <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void form.save(); }} noValidate>
      <section className="account-info" aria-labelledby="account-info-title">
        <h2 id="account-info-title">账号信息</h2>
        <p>登录手机号：<strong>{phoneMasked ?? '未提供'}</strong></p>
        <p className="field-hint">手机号、密码和实名认证信息不在此表单中修改，请前往账号安全设置管理。</p>
      </section>
      <AvatarField previewUrl={form.previewUrl} nickname={form.draft.nickname} error={form.errors.avatarImageId} progress={form.uploadProgress} disabled={form.uploadProgress != null} onChoose={(file) => void form.chooseAvatar(file)} />
      <TextField id="nickname" label="昵称" required value={form.draft.nickname} maxLength={30} error={form.errors.nickname} onChange={(value) => form.setField('nickname', value)} />
      <TextField id="bio" label="个人简介（选填）" multiline value={form.draft.bio ?? ''} maxLength={200} error={form.errors.bio} onChange={(value) => form.setField('bio', value || null)} />
      <GenderField value={form.draft.gender} error={form.errors.gender} onChange={(value) => form.setField('gender', value)} />
      <BirthdayField value={form.draft.birthDate} error={form.errors.birthDate} onChange={(value) => form.setField('birthDate', value)} />

      {form.message ? <div className={form.status === 'success' ? 'success-text' : 'global-error'} role={form.status === 'success' ? 'status' : 'alert'} aria-live="polite">{form.message}</div> : null}
      {form.status === 'conflict' && form.conflict ? <section className="conflict-panel" aria-labelledby="conflict-title">
        <h2 id="conflict-title">比较资料冲突</h2>
        <p>最新版昵称：{form.conflict.currentProfile.nickname}</p>
        <p>本地草稿昵称：{form.conflict.localDraft.nickname}</p>
        <button type="button" className="secondary-btn" onClick={() => form.resolveConflict('restore')}>恢复本地草稿并继续</button>
        <button type="button" className="secondary-btn" onClick={() => form.resolveConflict('discard')}>采用最新版并放弃草稿</button>
      </section> : null}
      <div className="profile-actions">
        <button type="button" className="secondary-btn" disabled={!form.dirty || form.status === 'saving'} onClick={() => void form.load()}>撤销更改</button>
        <button type="submit" className="submit-btn" disabled={!form.dirty || form.status === 'saving'}>{form.status === 'saving' ? '保存中…' : '保存资料'}</button>
      </div>
    </form>
  );
}
