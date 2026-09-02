/**
 * Auth Controller（T024/T025/T026/T047）——对接 contracts §1~§4
 * send-sms / login / refresh / logout / public-key 五个接口。
 */
import { Router } from 'express';
import { createPrivateKey, privateDecrypt, constants } from 'node:crypto';
import { sendSmsSchema, loginPayloadSchema, ErrorCode } from '@spec/shared-schemas';
import { ApiError } from '../../common/filters/response-filter.js';
import { ok } from '../../common/filters/response-filter.js';
import { smsService } from './sms.service.js';
import { security } from './security.instance.js';
import { securityLog } from '../../common/logs/security-log.service.js';
import { tokenService } from './token.service.js';
import { userRepository } from '../user/user.instance.js';
import { rsaManager } from './rsa-manager.js';
import { errorMessages } from './error-codes.js';
import { requireAuth } from '../../common/middleware/require-auth.js';

function msg(code: number): string {
  return errorMessages[code] ?? '请求失败，请稍后重试';
}

/** RSA-OAEP-2048 私钥解密：密码密文 → 明文（research §02 后端私钥解密） */
function decryptPassword(cipherB64: string, privatePem: string): string {
  // 测试通道：非生产环境支持 enc:<明文> 前缀，便于契约测试直接验证密码比对链路。
  // 生产环境前端始终走 RSA 加密，不会产生该前缀。
  if (process.env.NODE_ENV !== 'production' && cipherB64.startsWith('enc:')) {
    return cipherB64.slice('enc:'.length);
  }
  const key = createPrivateKey(privatePem);
  const cipher = Buffer.from(cipherB64, 'base64');
  const decrypted = privateDecrypt(
    {
      key,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    cipher
  );
  return decrypted.toString('utf8');
}

export const authRouter = Router();

/** GET /auth/public-key —— 返回前端加密用 RSA 公钥（T013 支撑） */
authRouter.get('/public-key', (_req, res) => {
  ok(res, rsaManager.getPublicKeyInfo());
});

/** POST /auth/send-sms —— 发送验证码（contracts §1 / spec FR-002 / FR-008） */
authRouter.post('/send-sms', async (req, res, next) => {
  try {
    const parsed = sendSmsSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      void securityLog.write(req, {
        eventType: 'SMS_SEND_ATTEMPT',
        actorType: 'ANONYMOUS',
        actorRef: 'unknown',
        result: 'BLOCKED',
        details: { reason: 'validation', path: first?.path.join('.') }
      });
      throw new ApiError(ErrorCode.INVALID_PHONE, 400, msg(ErrorCode.INVALID_PHONE));
    }
    const { phone } = parsed.data;

    // FR-002 60s 冷却
    if (await smsService.isInCooldown(phone)) {
      void securityLog.write(req, {
        eventType: 'SMS_SEND_BLOCKED_RATE_LIMIT',
        actorType: 'ANONYMOUS',
        actorRef: `ph:${phone.slice(-4)}`,
        result: 'BLOCKED',
        details: { reason: 'cooldown' }
      });
      throw new ApiError(ErrorCode.SMS_COOLDOWN, 429, msg(ErrorCode.SMS_COOLDOWN));
    }

    // FR-008 频控（IP + 手机号）
    const ipOk = await security.checkRateLimit('ip', req.ip ?? 'unknown');
    const phoneOk = await security.checkRateLimit('phone', phone);
    if (!ipOk || !phoneOk) {
      void securityLog.write(req, {
        eventType: 'RATE_LIMIT_HIT',
        actorType: 'ANONYMOUS',
        actorRef: `ph:${phone.slice(-4)}`,
        result: 'BLOCKED',
        details: { reason: 'rate-limit', ip: req.ip }
      });
      throw new ApiError(ErrorCode.RATE_LIMIT, 429, msg(ErrorCode.RATE_LIMIT));
    }

    const sent = await smsService.send(phone);
    // 真实环境在此调用第三方短信通道；测试/本地白名单手机号使用固定码（quickstart §1.2）
    void securityLog.write(req, {
      eventType: 'SMS_SEND_OK',
      actorType: 'ANONYMOUS',
      actorRef: `ph:${phone.slice(-4)}`,
      result: 'ALLOWED',
      details: { phoneMasked: `${phone.slice(0, 3)}****${phone.slice(-4)}` }
    });

    ok(res, {
      sentAt: new Date().toISOString(),
      expiresAt: sent.expiresAt,
      cooldownSeconds: sent.cooldownSeconds
    });
  } catch (error) {
    next(error);
  }
});

/** POST /auth/login —— 登录（contracts §2 / FR-001~FR-009 全链路校验） */
authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = loginPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const code = issue.path[0] === 'phone' ? ErrorCode.INVALID_PHONE : ErrorCode.MISSING_FIELD;
      void securityLog.write(req, {
        eventType: 'LOGIN_ATTEMPT',
        actorType: 'ANONYMOUS',
        actorRef: 'unknown',
        result: 'BLOCKED',
        details: { reason: 'validation', path: issue.path.join('.') }
      });
      throw new ApiError(code, 400, msg(code));
    }
    const { phone, code, encryptedPassword, deviceSessionId } = parsed.data;
    const phoneMask = `ph:${phone.slice(-4)}`;

    void securityLog.write(req, {
      eventType: 'LOGIN_ATTEMPT',
      actorType: 'ANONYMOUS',
      actorRef: phoneMask,
      result: 'ALLOWED',
      details: { step: 'begin' }
    });

    // FR-008 登录接口频控（同一 IP 每分钟 ≤ 20 次，同一手机号每小时 ≤ 10 次）
    const ipOk = await security.checkRateLimit('ip', req.ip ?? 'unknown');
    const phoneRateOk = await security.checkRateLimit('phone', phone);
    if (!ipOk || !phoneRateOk) {
      void securityLog.write(req, {
        eventType: 'RATE_LIMIT_HIT',
        actorType: 'ANONYMOUS',
        actorRef: phoneMask,
        result: 'BLOCKED',
        details: { reason: 'rate-limit', ip: req.ip }
      });
      throw new ApiError(ErrorCode.RATE_LIMIT, 429, msg(ErrorCode.RATE_LIMIT));
    }

    // FR-003 验证码校验
    const codeResult = await smsService.verify(phone, code);
    if (codeResult !== 'OK') {
      const locked = await security.checkAndIncrVerifyErrors(phone);
      const isExpired = codeResult === 'EXPIRED';
      const errCode = isExpired ? ErrorCode.CODE_EXPIRED : ErrorCode.CODE_WRONG;
      void securityLog.write(req, {
        eventType: 'LOGIN_FAIL_INVALID_CODE',
        actorType: 'ANONYMOUS',
        actorRef: phoneMask,
        result: 'BLOCKED',
        details: { reason: isExpired ? 'expired' : 'wrong-code', lockTriggered: locked }
      });
      throw new ApiError(locked ? ErrorCode.CODE_TOO_MANY_ATTEMPTS : errCode, 400, msg(locked ? ErrorCode.CODE_TOO_MANY_ATTEMPTS : errCode));
    }
    await security.resetVerifyErrors(phone);

    // FR-009 密码错误锁定预检
    if (await security.isPasswordLocked(phone)) {
      void securityLog.write(req, {
        eventType: 'LOGIN_FAIL_LOCKED',
        actorType: 'ANONYMOUS',
        actorRef: phoneMask,
        result: 'BLOCKED',
        details: { reason: 'password-locked' }
      });
      throw new ApiError(ErrorCode.ACCOUNT_LOCKED, 423, msg(ErrorCode.ACCOUNT_LOCKED));
    }

    // 用户查找：未注册与密码错误同文案（防枚举，spec Edge Cases / data-model V-11）
    const user = userRepository.findByPhone(phone);
    let passwordOk = false;
    if (user) {
      try {
        const plain = decryptPassword(encryptedPassword, rsaManager.loadPrivateKey());
        passwordOk = userRepository.verifyPassword(user, plain);
      } catch {
        // RSA 解密失败视为恶意入参（记录 10010 内部，对外 10006）
        passwordOk = false;
      }
    }

    if (!user || !passwordOk) {
      const lockTriggered = user ? await security.checkAndIncrPasswordErrors(phone) : false;
      void securityLog.write(req, {
        eventType: 'LOGIN_FAIL_INVALID_PASSWORD',
        actorType: 'ANONYMOUS',
        actorRef: phoneMask,
        result: 'BLOCKED',
        details: { userExists: !!user, lockTriggered }
      });
      if (lockTriggered) {
        void securityLog.write(req, {
          eventType: 'LOGIN_FAIL_LOCKED',
          actorType: 'ANONYMOUS',
          actorRef: phoneMask,
          result: 'BLOCKED',
          details: { reason: 'password-threshold' }
        });
      }
      // 未注册用户与密码错误返回完全一致（防枚举）
      throw new ApiError(lockTriggered ? ErrorCode.ACCOUNT_LOCKED : ErrorCode.PASSWORD_WRONG, lockTriggered ? 423 : 400, msg(lockTriggered ? ErrorCode.ACCOUNT_LOCKED : ErrorCode.PASSWORD_WRONG));
    }

    // 账号状态检查（data-model §1 状态机）
    if (user.accountStatus !== 'ACTIVE') {
      if (user.accountStatus === 'LOCKED' && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        throw new ApiError(ErrorCode.ACCOUNT_LOCKED, 423, msg(ErrorCode.ACCOUNT_LOCKED));
      }
    }
    await security.resetPasswordErrors(phone);

    // 签发双 Token（FR-005 / FR-006 / FR-010）
    const pair = tokenService.issuePair(user.userId, user.phoneHash, deviceSessionId ?? 'default');
    const maskedPhone = `${phone.slice(0, 3)}****${phone.slice(-4)}`;

    res.setHeader(
      'Set-Cookie',
      `refresh_token=${pair.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=${7 * 24 * 3600}`
    );

    void securityLog.write(req, {
      eventType: 'LOGIN_OK',
      actorType: 'USER',
      actorRef: user.userId,
      result: 'ALLOWED',
      details: { deviceSessionId }
    });

    ok(res, {
      accessToken: pair.accessToken,
      accessTokenExpiresAt: pair.accessTokenExpiresAt,
      user: {
        userId: user.userId,
        phoneMasked: maskedPhone,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl
      },
      deviceSessionId: deviceSessionId ?? 'default'
    });
  } catch (error) {
    next(error);
  }
});

/** POST /auth/refresh —— 静默续期（contracts §3 / P3 US1） */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = (req.headers.cookie ?? '')
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('refresh_token='))
      ?.slice('refresh_token='.length);

    if (!refreshToken) {
      throw new ApiError(ErrorCode.TOKEN_EXPIRED, 401, msg(ErrorCode.TOKEN_EXPIRED));
    }

    let payload;
    try {
      payload = tokenService.verify(refreshToken, 'refresh');
    } catch {
      throw new ApiError(ErrorCode.TOKEN_INVALID, 401, msg(ErrorCode.TOKEN_INVALID));
    }

    if (await tokenService.isRevoked(payload.jti)) {
      void securityLog.write(req, {
        eventType: 'TOKEN_REVOKED',
        actorType: 'USER',
        actorRef: payload.sub,
        result: 'BLOCKED',
        details: { reason: 'revoked-jti' }
      });
      throw new ApiError(ErrorCode.TOKEN_INVALID, 401, msg(ErrorCode.TOKEN_INVALID));
    }

    // 旧 refresh 消费 → 吊销；签发新对
    await tokenService.revokeRefresh(payload.jti, 'ROTATED');
    const pair = tokenService.issuePair(payload.sub, payload.phoneHash ?? '', payload.deviceSessionId);
    res.setHeader(
      'Set-Cookie',
      `refresh_token=${pair.refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=${7 * 24 * 3600}`
    );
    void securityLog.write(req, {
      eventType: 'TOKEN_REFRESHED',
      actorType: 'USER',
      actorRef: payload.sub,
      result: 'ALLOWED',
      details: { deviceSessionId: payload.deviceSessionId }
    });

    ok(res, {
      accessToken: pair.accessToken,
      accessTokenExpiresAt: pair.accessTokenExpiresAt
    });
  } catch (error) {
    next(error);
  }
});

/** POST /auth/logout —— 主动登出（contracts §4 / T047） */
authRouter.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const allDevices = (req.body as { allDevices?: boolean }).allDevices ?? false;
    const auth = req.auth;
    if (auth) {
      if (allDevices) {
        await tokenService.revokeAllForUser(auth.sub);
      } else {
        // 当前 refresh jti 由 cookie 解析；无 refresh 时至少吊销已存在的 access jti
        const refreshToken = (req.headers.cookie ?? '')
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith('refresh_token='))
          ?.slice('refresh_token='.length);
        if (refreshToken) {
          try {
            const payload = tokenService.verify(refreshToken, 'refresh');
            await tokenService.revokeRefresh(payload.jti, 'USER_LOGOUT');
          } catch {
            // refresh 已失效则忽略
          }
        }
      }
      void securityLog.write(req, {
        eventType: 'TOKEN_REVOKED',
        actorType: 'USER',
        actorRef: auth.sub,
        result: 'ALLOWED',
        details: { allDevices }
      });
    }
    res.setHeader('Set-Cookie', `refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=0`);
    ok(res, { loggedOutAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});
