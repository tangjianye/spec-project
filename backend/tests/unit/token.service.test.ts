/**
 * T053 后端 Token 服务单测（data-model §3 状态机 / FR-006）
 */
import { describe, expect, it } from 'vitest';
import { TokenService } from '../../src/modules/auth/token.service.js';
import { InMemoryStore } from './helpers/in-memory-store.js';

describe('TokenService（FR-005/FR-006）', () => {
  const kv = new InMemoryStore();
  const svc = new TokenService(kv as never);

  it('签发双 Token：access 可验证、refresh 可验证（FR-005）', () => {
    const pair = svc.issuePair('u_1', 'hash', 'device-1');
    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    const access = svc.verify(pair.accessToken, 'access');
    expect(access.sub).toBe('u_1');
    const refresh = svc.verify(pair.refreshToken, 'refresh');
    expect(refresh.kind).toBe('refresh');
  });

  it('access 令牌无法冒充 refresh（类型校验）', () => {
    const pair = svc.issuePair('u_1', 'hash', 'device-1');
    expect(() => svc.verify(pair.accessToken, 'refresh')).toThrow();
  });

  it('吊销后 refresh 进入黑名单（FR-006 / TOKEN_REVOKED）', async () => {
    const pair = svc.issuePair('u_1', 'hash', 'device-1');
    expect(await svc.isRevoked(pair.refreshJti)).toBe(false);
    await svc.revokeRefresh(pair.refreshJti, 'USER_LOGOUT');
    expect(await svc.isRevoked(pair.refreshJti)).toBe(true);
  });
});
