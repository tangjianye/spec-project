import { profileUpdateSchema, type ProfileUpdatePayload } from '@spec/shared-schemas';

export type ProfileDraft = Omit<ProfileUpdatePayload, 'expectedVersion'>;
export type ProfileField = keyof ProfileDraft;

export const profileMessages: Record<string, string> = {
  nickname: '昵称需为 2 至 30 个可见字符',
  bio: '个人简介不能超过 200 个字符',
  gender: '请选择有效的性别选项',
  birthDate: '生日格式不正确且不能晚于今天',
  avatarImageId: '头像不可用，请重新上传'
};

export function validateProfile(draft: ProfileDraft, expectedVersion: number) {
  const result = profileUpdateSchema.safeParse({ ...draft, expectedVersion });
  if (result.success) return { data: result.data, errors: {} as Partial<Record<ProfileField, string>> };
  const errors: Partial<Record<ProfileField, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as ProfileField;
    if (field in profileMessages && !errors[field]) errors[field] = profileMessages[field];
  }
  return { data: null, errors };
}
