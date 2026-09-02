/**
 * T053 后端 User 模型单测（data-model §1 / FR-004 / V-11 防枚举）
 */
import { describe, expect, it } from 'vitest';
import { UserRepository, sha256 } from '../../src/modules/user/user.entity.js';

describe('UserRepository（FR-004 / V-11）', () => {
  const repo = new UserRepository();
  repo.seed('Password123!');

  it('密码哈希验证：正确/错误（FR-004）', () => {
    const user = repo.findByPhone('13800000001');
    expect(user).not.toBeNull();
    expect(repo.verifyPassword(user!, 'Password123!')).toBe(true);
    expect(repo.verifyPassword(user!, 'wrong')).toBe(false);
  });

  it('手机号以可检索哈希存储，不落明文（V-11）', () => {
    const user = repo.findByPhone('13800000001');
    expect(user?.phoneHash).not.toContain('13800000001');
    expect(sha256('phone:13800000001')).toBe(user?.phoneHash);
  });

  it('未注册手机号查询返回 null（防枚举）', () => {
    expect(repo.findByPhone('13800000099')).toBeNull();
  });
});
