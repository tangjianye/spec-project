/**
 * Token 服务（T014）——对齐 data-model §3 AuthToken
 * 双 Token：Access 2h（内存）+ Refresh 7d（HttpOnly Cookie）。
 * 支持 jti 级吊销（登出/改密/风控），吊销列表写 Redis 短 TTL 黑名单。
 */
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { config } from '../../config/env.js';
import { store, type KVStore } from '../../common/redis/redis.js';

export interface TokenPayload {
  sub: string; // userId
  jti: string;
  deviceSessionId: string;
  kind: 'access' | 'refresh';
  phoneHash?: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string; // 下发到 HttpOnly Cookie
  refreshJti: string;
  refreshExpiresAt: string;
}

function ttlSeconds(ttl: string): number {
  if (ttl.endsWith('h')) return Number.parseInt(ttl, 10) * 3600;
  if (ttl.endsWith('d')) return Number.parseInt(ttl, 10) * 86400;
  if (ttl.endsWith('m')) return Number.parseInt(ttl, 10) * 60;
  return Number.parseInt(ttl, 10);
}

export class TokenService {
  constructor(private readonly kv: KVStore) {}

  issuePair(userId: string, phoneHash: string, deviceSessionId: string): TokenPair {
    const refreshJti = randomUUID();
    const accessPayload: TokenPayload = {
      sub: userId,
      jti: randomUUID(),
      deviceSessionId,
      kind: 'access',
      phoneHash
    };
    const refreshPayload: TokenPayload = {
      sub: userId,
      jti: refreshJti,
      deviceSessionId,
      kind: 'refresh',
      phoneHash
    };

    const accessToken = jwt.sign(accessPayload, config.jwtSecret, {
      expiresIn: config.accessTokenTtl as jwt.SignOptions['expiresIn']
    });
    const refreshToken = jwt.sign(refreshPayload, config.jwtSecret, {
      expiresIn: config.refreshTokenTtl as jwt.SignOptions['expiresIn']
    });

    const now = Date.now();
    return {
      accessToken,
      accessTokenExpiresAt: new Date(now + ttlSeconds(config.accessTokenTtl) * 1000).toISOString(),
      refreshToken,
      refreshJti,
      refreshExpiresAt: new Date(now + ttlSeconds(config.refreshTokenTtl) * 1000).toISOString()
    };
  }

  verify(token: string, kind: 'access' | 'refresh'): TokenPayload {
    const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & Partial<TokenPayload>;
    if (payload.kind !== kind) {
      throw new Error('TOKEN_KIND_MISMATCH');
    }
    return {
      sub: payload.sub!,
      jti: payload.jti!,
      deviceSessionId: payload.deviceSessionId ?? 'unknown',
      kind,
      phoneHash: payload.phoneHash
    };
  }

  /** 吊销 refresh jti：写入黑名单，TTL = refresh 剩余有效期 */
  async revokeRefresh(jti: string, reason: string, ttlSecondsValue?: number): Promise<void> {
    await this.kv.set(`revoked:${jti}`, reason, ttlSecondsValue ?? ttlSeconds(config.refreshTokenTtl));
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.kv.get(`revoked:${jti}`)) !== null;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    // 黑名单按 jti 精确匹配；按用户整体吊销由调用方传入该用户所有 refresh jti（简化实现）
    await this.kv.set(`revoked:user:${userId}`, 'PASSWORD_CHANGED', ttlSeconds(config.refreshTokenTtl));
  }
}

export const tokenService = new TokenService(store);
