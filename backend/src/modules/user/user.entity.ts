/**
 * User 账户模型（T012）——对齐 data-model §1
 * 字段/校验/状态机完全映射 spec FR-001/FR-004/FR-009。
 * 内存实现供无 DB 的测试/本地运行；生产接入关系型数据库时替换 repository 即可。
 */
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { NormalizedProfileUpdate, ProfileGender, UserProfile } from '@spec/shared-schemas';

export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

export interface UserRecord {
  userId: string;
  phoneHash: string; // 手机号可检索哈希（防枚举，不落明文）
  nickname: string;
  avatarUrl: string;
  avatarImageId: string | null;
  bio: string | null;
  gender: ProfileGender;
  birthDate: string | null;
  profileVersion: number;
  profileUpdatedAt: string;
  passwordHash: string; // bcrypt
  accountStatus: AccountStatus;
  lockedUntil: string | null;
  passwordErrorCount: number;
}

export class UserRepository {
  private readonly users = new Map<string, UserRecord>(); // key: phoneHash
  private readonly byId = new Map<string, UserRecord>();

  /** 手机号可检索哈希：SHA-256，避免明文落库且支持精确匹配（data-model §1 敏感字段约束） */
  static hashPhone(phone: string): string {
    return sha256(`phone:${phone}`);
  }

  /** 内存种子账号，供本地/测试使用（quickstart §1.2 测试账号） */
  seed(passwordPlain: string = 'Password123!'): void {
    const rows: Array<[string, string, AccountStatus, number, string | null]> = [
      ['13800000001', '用户一', 'ACTIVE', 0, null],
      ['13800000002', '用户二', 'ACTIVE', 9, null],
      ['13800000003', '用户三', 'LOCKED', 0, new Date(Date.now() + 20 * 60_000).toISOString()],
      ['13800000004', '资料测试用户', 'ACTIVE', 0, null]
    ];
    const pwdHash = bcrypt.hashSync(passwordPlain, 10);
    for (const [phone, nickname, status, errorCount, lockedUntil] of rows) {
      this.upsert({
        userId: `u_${phone.slice(-4)}`,
        phoneHash: UserRepository.hashPhone(phone),
        nickname,
        avatarUrl: '',
        avatarImageId: null,
        bio: null,
        gender: null,
        birthDate: null,
        profileVersion: 1,
        profileUpdatedAt: new Date().toISOString(),
        passwordHash: pwdHash,
        accountStatus: status,
        lockedUntil,
        passwordErrorCount: errorCount
      });
    }
  }

  upsert(record: UserRecord): void {
    this.users.set(record.phoneHash, record);
    this.byId.set(record.userId, record);
  }

  findByPhone(phone: string): UserRecord | null {
    return this.users.get(UserRepository.hashPhone(phone)) ?? null;
  }

  findById(userId: string): UserRecord | null {
    return this.byId.get(userId) ?? null;
  }

  toProfile(record: UserRecord): UserProfile {
    return {
      userId: record.userId,
      nickname: record.nickname,
      bio: record.bio,
      gender: record.gender,
      birthDate: record.birthDate,
      avatarImageId: record.avatarImageId,
      avatarUrl: record.avatarUrl,
      version: record.profileVersion,
      updatedAt: record.profileUpdatedAt
    };
  }

  updateProfile(
    userId: string,
    update: NormalizedProfileUpdate,
    avatarUrl: string
  ): { status: 'updated'; profile: UserProfile } | { status: 'conflict'; profile: UserProfile } | { status: 'missing' } {
    const current = this.byId.get(userId);
    if (!current) return { status: 'missing' };
    if (current.profileVersion !== update.expectedVersion) {
      return { status: 'conflict', profile: this.toProfile(current) };
    }

    const updated: UserRecord = {
      ...current,
      nickname: update.nickname,
      bio: update.bio,
      gender: update.gender,
      birthDate: update.birthDate,
      avatarImageId: update.avatarImageId,
      avatarUrl,
      profileVersion: current.profileVersion + 1,
      profileUpdatedAt: new Date().toISOString()
    };
    this.upsert(updated);
    return { status: 'updated', profile: this.toProfile(updated) };
  }

  verifyPassword(record: UserRecord, plain: string): boolean {
    return bcrypt.compareSync(plain, record.passwordHash);
  }
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
