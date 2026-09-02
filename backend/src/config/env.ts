/**
 * 环境配置读取（T005）
 * 所有配置值来自环境变量，生产环境通过部署平台注入；本地使用根目录 .env。
 */

export interface AppConfig {
  port: number;
  frontendOrigin: string;
  redisUrl: string;
  smsProviderKey: string;
  smsTestWhitelist: string[];
  smsTestFixedCode: string;
  rsaPrivateKeyPath: string | undefined;
  rsaPrivateKeyPem: string | undefined;
  rsaKid: string;
  jwtSecret: string;
  accessTokenTtl: string;
  refreshTokenTtl: string;
  smsCooldownSeconds: number;
  smsCodeTtlSeconds: number;
  smsMaxVerifyErrors: number;
  smsLockMinutes: number;
  passwordMaxErrors: number;
  accountLockMinutes: number;
  ipRateLimitPerMinute: number;
  phoneRateLimitPerHour: number;
  /** 测试/本地模式：无真实 Redis 时使用内存存储（便于单测与本地验证） */
  useInMemoryStore: boolean;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : Number.parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : n;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
}

export function loadConfig(): AppConfig {
  return {
    port: int('PORT', 3001),
    frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
    smsProviderKey: process.env.SMS_PROVIDER_KEY ?? 'test-provider-key',
    smsTestWhitelist: (process.env.SMS_TEST_WHITELIST ?? '13800000000,13800000001,13800000002,13800000003,13800000004,13800000005,13800000006')
      .split(',')
      .filter(Boolean),
    smsTestFixedCode: process.env.SMS_TEST_FIXED_CODE ?? '135792',
    rsaPrivateKeyPath: process.env.RSA_PRIVATE_KEY_PEM?.startsWith('file://')
      ? process.env.RSA_PRIVATE_KEY_PEM.slice('file://'.length)
      : undefined,
    rsaPrivateKeyPem:
      process.env.RSA_PRIVATE_KEY_PEM && !process.env.RSA_PRIVATE_KEY_PEM.startsWith('file://')
        ? process.env.RSA_PRIVATE_KEY_PEM
        : undefined,
    rsaKid: process.env.RSA_KID ?? 'rsa-20260901',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret',
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '2h',
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? '7d',
    smsCooldownSeconds: int('SMS_COOLDOWN_SECONDS', 60),
    smsCodeTtlSeconds: int('SMS_CODE_TTL_SECONDS', 300),
    smsMaxVerifyErrors: int('SMS_MAX_VERIFY_ERRORS', 5),
    smsLockMinutes: int('SMS_LOCK_MINUTES', 10),
    passwordMaxErrors: int('PASSWORD_MAX_ERRORS', 10),
    accountLockMinutes: int('ACCOUNT_LOCK_MINUTES', 30),
    ipRateLimitPerMinute: int('IP_RATE_LIMIT_PER_MINUTE', 20),
    phoneRateLimitPerHour: int('PHONE_RATE_LIMIT_PER_HOUR', 10),
    useInMemoryStore: bool('USE_IN_MEMORY_STORE', process.env.NODE_ENV === 'test' || !process.env.REDIS_URL)
  };
}

export const config = loadConfig();
