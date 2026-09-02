import { useCallback, useEffect, useMemo, useState } from 'react';
import { ErrorCode, type UserProfile } from '@spec/shared-schemas';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { getProfile, ProfileRequestError, updateProfile, uploadAvatar } from '../services/profileApi';
import { type ProfileDraft, type ProfileField, validateProfile } from '../schemas/profileSchema';
import { useUnsavedChanges } from './useUnsavedChanges';

const emptyDraft: ProfileDraft = { nickname: '', bio: null, gender: null, birthDate: null, avatarImageId: null };

function draftFrom(profile: UserProfile): ProfileDraft {
  return {
    nickname: profile.nickname,
    bio: profile.bio,
    gender: profile.gender,
    birthDate: profile.birthDate,
    avatarImageId: profile.avatarImageId
  };
}

export function useProfileForm() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<ProfileField, string>>>({});
  const [status, setStatus] = useState<'loading' | 'idle' | 'saving' | 'success' | 'error' | 'conflict'>('loading');
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const updateSummary = useAuthStore((state) => state.updateUserSummary);

  const dirty = useMemo(() => !!profile && JSON.stringify(draft) !== JSON.stringify(draftFrom(profile)), [draft, profile]);
  useUnsavedChanges(dirty);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const latest = await getProfile();
      setProfile(latest);
      setDraft(draftFrom(latest));
      setPreviewUrl(latest.avatarUrl);
      setErrors({});
      setStatus('idle');
      setMessage('');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : '资料加载失败');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends ProfileField>(field: K, value: ProfileDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (status === 'success') setStatus('idle');
  };

  const save = async () => {
    if (!profile || !dirty) return;
    const checked = validateProfile(draft, profile.version);
    if (!checked.data) {
      setErrors(checked.errors);
      setStatus('error');
      setMessage('请修正标记的字段后再保存');
      return;
    }
    setStatus('saving');
    try {
      const saved = await updateProfile(checked.data);
      setProfile(saved);
      setDraft(draftFrom(saved));
      setPreviewUrl(saved.avatarUrl);
      updateSummary({ nickname: saved.nickname, avatarUrl: saved.avatarUrl });
      setErrors({});
      setStatus('success');
      setMessage('个人资料已保存');
    } catch (error) {
      if (error instanceof ProfileRequestError) {
        const fieldErrors: Partial<Record<ProfileField, string>> = {};
        for (const item of error.errors) fieldErrors[item.field as ProfileField] = item.message;
        setErrors(fieldErrors);
        setStatus(error.code === ErrorCode.PROFILE_CONFLICT ? 'conflict' : 'error');
        setMessage(error.message);
      } else {
        setStatus('error');
        setMessage('网络异常，请检查网络连接');
      }
    }
  };

  const chooseAvatar = async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrors((current) => ({ ...current, avatarImageId: '请选择 JPEG、PNG 或 WebP 图片' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((current) => ({ ...current, avatarImageId: '头像图片不能超过 5 MB' }));
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    try {
      const uploaded = await uploadAvatar(file);
      setField('avatarImageId', uploaded.imageId);
      setPreviewUrl(uploaded.previewUrl);
      URL.revokeObjectURL(localUrl);
    } catch (error) {
      URL.revokeObjectURL(localUrl);
      setPreviewUrl(profile?.avatarUrl ?? '');
      setErrors((current) => ({ ...current, avatarImageId: error instanceof Error ? error.message : '头像上传失败' }));
    }
  };

  return { profile, draft, errors, status, message, previewUrl, dirty, setField, save, load, chooseAvatar };
}
