/**
 * 安全日志写入基础设施（T011）——对齐 data-model §4 SecurityLog
 * 所有登录相关安全事件异步写入；禁止落明文密码 / 明文验证码。
 */
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';

export type SecurityEventType =
  | 'SMS_SEND_ATTEMPT'
  | 'SMS_SEND_OK'
  | 'SMS_SEND_BLOCKED_RATE_LIMIT'
  | 'LOGIN_ATTEMPT'
  | 'LOGIN_OK'
  | 'LOGIN_FAIL_INVALID_CODE'
  | 'LOGIN_FAIL_INVALID_PASSWORD'
  | 'LOGIN_FAIL_LOCKED'
  | 'LOGIN_FAIL_ENUM_PROTECTION'
  | 'RATE_LIMIT_HIT'
  | 'TOKEN_REFRESHED'
  | 'TOKEN_REVOKED'
  | 'MALICIOUS_INPUT_DETECTED';

export interface SecurityLogEntry {
  eventId: string;
  eventType: SecurityEventType;
  actorType: 'USER' | 'ANONYMOUS' | 'SYSTEM';
  actorRef: string;
  clientIp: string;
  userAgent: string;
  result: 'ALLOWED' | 'BLOCKED' | 'ERROR';
  details: Record<string, unknown>;
  createdAt: string;
}

export function safeRedact(value: unknown): unknown {
  // 防止明文验证码 / 密码落入日志（data-model §4 业务规则 1）
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (/^\d{6}$/.test(value)) return '******';
    if (value.length > 64) return `${value.slice(0, 16)}...<truncated>`;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = /password|passwd|code|secret|token/i.test(k) ? '****' : safeRedact(v);
    }
    return out;
  }
  return value;
}

export class SecurityLogService {
  /** 生产可替换为真实队列 / 存储，此处 fire-and-forget 写 stdout（JSON 行），保证不影响主流程 P95 */
  async write(
    req: Request | undefined,
    entry: Omit<SecurityLogEntry, 'eventId' | 'createdAt' | 'clientIp' | 'userAgent'>
  ): Promise<void> {
    const ip = req?.ip ?? '0.0.0.0';
    const ua = (req?.headers['user-agent'] ?? '').slice(0, 512);
    const record: SecurityLogEntry = {
      eventId: randomUUID(),
      createdAt: new Date().toISOString(),
      clientIp: ip,
      userAgent: ua,
      ...entry,
      details: safeRedact(entry.details) as Record<string, unknown>
    };
    // 异步落盘，不 await 以免拖慢请求（可替换为消息队列）
    Promise.resolve().then(() => {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ channel: 'security-log', ...record }));
    });
  }
}

export const securityLog = new SecurityLogService();
