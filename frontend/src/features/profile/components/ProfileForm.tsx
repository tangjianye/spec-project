import { AvatarField } from './AvatarField';
import { BirthdayField } from './BirthdayField';
import { GenderField } from './GenderField';
import { TextField } from './TextField';
import { useProfileForm } from '../hooks/useProfileForm';

export function ProfileForm() {
  const form = useProfileForm();
  if (form.status === 'loading') return <p aria-busy="true">正在加载个人资料…</p>;
  if (!form.profile) return <div role="alert"><p>{form.message}</p><button type="button" onClick={() => void form.load()}>重新加载</button></div>;

  return (
    <form className="profile-form" onSubmit={(event) => { event.preventDefault(); void form.save(); }} noValidate>
      <AvatarField previewUrl={form.previewUrl} nickname={form.draft.nickname} error={form.errors.avatarImageId} onChoose={(file) => void form.chooseAvatar(file)} />
      <TextField id="nickname" label="昵称" required value={form.draft.nickname} maxLength={30} error={form.errors.nickname} onChange={(value) => form.setField('nickname', value)} />
      <TextField id="bio" label="个人简介（选填）" multiline value={form.draft.bio ?? ''} maxLength={200} error={form.errors.bio} onChange={(value) => form.setField('bio', value || null)} />
      <GenderField value={form.draft.gender} error={form.errors.gender} onChange={(value) => form.setField('gender', value)} />
      <BirthdayField value={form.draft.birthDate} error={form.errors.birthDate} onChange={(value) => form.setField('birthDate', value)} />

      {form.message ? <div className={form.status === 'success' ? 'success-text' : 'global-error'} role={form.status === 'success' ? 'status' : 'alert'} aria-live="polite">{form.message}</div> : null}
      {form.status === 'conflict' ? <button type="button" className="secondary-btn" onClick={() => void form.load()}>加载最新资料</button> : null}
      <div className="profile-actions">
        <button type="button" className="secondary-btn" disabled={!form.dirty || form.status === 'saving'} onClick={() => void form.load()}>撤销更改</button>
        <button type="submit" className="submit-btn" disabled={!form.dirty || form.status === 'saving'}>{form.status === 'saving' ? '保存中…' : '保存资料'}</button>
      </div>
    </form>
  );
}
