import { ErrorCode, profileUpdateSchema, type UserProfile } from '@spec/shared-schemas';
import { ApiError } from '../../common/filters/response-filter.js';
import type { UserRepository } from './user.entity.js';
import type { AvatarStorage } from './avatar-storage.js';

const validationMessage = '个人资料内容不符合要求';

export class ProfileService {
  constructor(
    private readonly users: UserRepository,
    private readonly avatars: AvatarStorage
  ) {}

  get(userId: string): UserProfile {
    const user = this.users.findById(userId);
    if (!user) throw new ApiError(ErrorCode.TOKEN_INVALID, 401, '登录凭证无效，请重新登录');
    return this.users.toProfile(user);
  }

  update(userId: string, input: unknown): UserProfile {
    const parsed = profileUpdateSchema.safeParse(input);
    if (!parsed.success) {
      throw new ApiError(
        ErrorCode.PROFILE_VALIDATION,
        400,
        validationMessage,
        parsed.error.issues.map((issue) => ({ field: String(issue.path[0] ?? '_body'), message: validationMessage }))
      );
    }

    let avatarUrl = '';
    if (parsed.data.avatarImageId) {
      const image = this.avatars.findOwnedBindable(userId, parsed.data.avatarImageId);
      if (!image) throw new ApiError(ErrorCode.AVATAR_UNAVAILABLE, 400, '头像不可用，请重新上传');
      avatarUrl = image.publicUrl;
    }

    const result = this.users.updateProfile(userId, parsed.data, avatarUrl);
    if (result.status === 'missing') {
      throw new ApiError(ErrorCode.TOKEN_INVALID, 401, '登录凭证无效，请重新登录');
    }
    if (result.status === 'conflict') {
      throw new ApiError(
        ErrorCode.PROFILE_CONFLICT,
        409,
        '资料已在其他位置更新，请加载最新内容后重试',
        [],
        { currentProfile: result.profile }
      );
    }
    if (parsed.data.avatarImageId) this.avatars.activate(userId, parsed.data.avatarImageId);
    return result.profile;
  }
}
