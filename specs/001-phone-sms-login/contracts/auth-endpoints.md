# Contracts: Auth API 接口契约（手机号验证码登录）

**Created**: 2026-09-01
**Feature**: [spec.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/spec.md)
**Data Model**: [data-model.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/data-model.md)

---

## 契约说明

本文档定义本功能对外暴露的 HTTP 接口（前端 SPA → 后端服务）契约，包含：
1. 统一请求/响应头部、错误格式
2. 4 个核心接口：发送验证码、登录、刷新令牌、登出
3. 每个接口的字段校验规则（对齐 Zod schema，前后端共用同一套约束）
4. 鉴权方式 & 失败跳转语义

> 实现提示：本契约只描述 WHAT（字段、状态码、校验），不描述 HOW（具体中间件、框架）。所有字段级校验在前后端双重执行以满足 FR-007。

---

## 0. 通用约定

### 基础地址 & 内容类型

| 项 | 约定 |
|----|------|
| Base URL | `/api/v1/auth`（同项目其他模块保持一致前缀规范） |
| Content-Type | 所有请求：`application/json; charset=utf-8` |
| 字符集 | UTF-8 |
| 时间字段格式 | ISO 8601 `YYYY-MM-DDTHH:mm:ss.sssZ`（UTC） |

### 统一成功响应信封

```json
{
  "code": 0,
  "message": "ok",
  "data": { /* 各接口自己的响应体 */ },
  "requestId": "req_20260901170000_abcdef"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | `0` 表示成功；非 0 对应下文错误码 |
| message | string | 人类可读说明；**可直接显示给用户** |
| data | object \| null | 业务数据；成功时非 null（即便 `{}`） |
| requestId | string | 每请求唯一，用于对接 SecurityLog 和排障 |

### 统一错误响应信封

```json
{
  "code": 10003,
  "message": "验证码已过期，请重新获取",
  "errors": [
    { "field": "code", "message": "验证码已过期，请重新获取" }
  ],
  "requestId": "req_20260901170000_xyz123"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 错误码；详见"错误码矩阵" |
| message | string | 总括性错误说明，**不暴露技术细节** |
| errors | Array<{field, message}> | 可选；字段级错误，前端可直接绑定到对应输入框下方 |
| requestId | string | 排障/日志关联 |

### 错误码矩阵（业务相关，不含 5xx 系统错误）

| code | HTTP 状态码 | 文案（message 固定） | 触发接口 | 关联 spec |
|------|------------|---------------------|---------|----------|
| 10001 | 400 | 请输入正确的 11 位手机号 | SEND_SMS / LOGIN | FR-001 (V-01) |
| 10002 | 429 | 获取验证码过于频繁，请 60 秒后再试 | SEND_SMS | FR-002 (V-03) |
| 10003 | 400 | 验证码已过期，请重新获取 | LOGIN | FR-003 (V-03) |
| 10004 | 400 | 验证码错误，请重新输入 | LOGIN | FR-003 (V-04) |
| 10005 | 423 | 错误次数过多，请 10 分钟后重试（验证码侧） | LOGIN | FR-003 (V-06) |
| 10006 | 400 | 密码错误，请重试 | LOGIN | FR-009（对未注册同号同文案，防枚举） |
| 10007 | 423 | 密码错误次数过多，账号已临时锁定，请 30 分钟后重试或找回密码 | LOGIN | FR-009 (V-05) |
| 10008 | 400 | 此项为必填项（配合 errors[].field 告知是哪项） | LOGIN | P2 Scenario 5 |
| 10009 | 429 | 操作过于频繁，请稍后重试（IP/手机号限流） | SEND_SMS / LOGIN | FR-008 (V-07) |
| 10010 | 400 | 请求包含非法参数，请检查输入内容 | 任意接口 | FR-007 (V-10) |
| 10011 | 401 | 登录状态已过期，请重新登录 | 所有鉴权接口 | P3 US1 (V-09) |
| 10012 | 401 | 登录凭证无效，请重新登录 | 所有鉴权接口 | P3 US2 (V-09) |

> 5xx 类（500/502/503/504）系统级错误统一 message 为 "服务暂不可用，请稍后重试"，并保留 requestId 供排障。

### 鉴权方式

- **Access Token**：请求头 `Authorization: Bearer <access_token>`。仅 REFRESH / LOGOUT 等需要身份的接口使用（本功能中 LOGIN/SEND_SMS 无需此头）。
- **Refresh Token**：通过 `Set-Cookie` 在登录/刷新成功时下发；属性 `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=604800`（7 天）。
- **刷新流程**：任一接口返回 HTTP 401 + code=10011/10012 → 前端拦截器静默调 `/refresh` → 成功则重放原请求 → 失败则清除登录态跳转 `/login`。

---

## 1. 发送短信验证码

```
POST /api/v1/auth/send-sms
Authorization: (无)
```

### 请求体

```json
{
  "phone": "13800138000",
  "scenario": "LOGIN"
}
```

| 字段 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|---------|------|
| phone | string | ✅ | 正则 `^1[3-9]\d{9}$`，长度严格 11 | 目标手机号 |
| scenario | string | ✅ | 仅接受枚举：`LOGIN` | 预留 REGISTER/RESET 等；本次只允许 LOGIN |

### 成功响应（HTTP 200）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "sentAt": "2026-09-01T09:00:00.000Z",
    "expiresAt": "2026-09-01T09:05:00.000Z",
    "cooldownSeconds": 60
  },
  "requestId": "req_20260901_001"
}
```

| data 字段 | 类型 | 说明 |
|----------|------|------|
| sentAt | string | 发送时间（UTC）；可用于前端计算倒计时起点 |
| expiresAt | string | 验证码过期时间；对齐 V-03 5 分钟 |
| cooldownSeconds | number | 再次允许发送的冷却秒数，固定 60 |

### 可能失败

| code | 触发条件 |
|------|---------|
| 10001 | phone 正则不匹配 |
| 10002 | 同 phone+LOGIN 60 秒内重复请求 |
| 10009 | IP 1min > 20 或 phone 1hr > 10 限流 |
| 10010 | scenario 非法 / 存在 XSS 字符等 |

---

## 2. 登录（手机号 + 验证码 + 密码）

```
POST /api/v1/auth/login
Authorization: (无)
```

### 请求体

```json
{
  "phone": "13800138000",
  "code": "135792",
  "encryptedPassword": "hS1x...<RSA-2048 encrypted string>...a2Q==",
  "deviceSessionId": "web_chrome_e4f9...<UUID>"
}
```

| 字段 | 类型 | 必填 | 校验规则 | 说明 |
|------|------|------|---------|------|
| phone | string | ✅ | 正则 `^1[3-9]\d{9}$` | 同 send-sms |
| code | string | ✅ | 正则 `^\d{6}$`，且不允许弱码（非同号/不连续） | 6 位验证码；错误次数累计 |
| encryptedPassword | string | ✅ | Base64 编码；后端解密后长度 ≥ 8（不足对应 10006） | RSA 公钥加密后的密码密文 |
| deviceSessionId | string | 可选 | 前端 UUID；如不传则后端基于 IP+UA 生成 | 区分多端登录 |

### 成功响应（HTTP 200）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJhbGciOi...<2h JWT>...",
    "accessTokenExpiresAt": "2026-09-01T11:00:00.000Z",
    "user": {
      "userId": "u_abc123",
      "phoneMasked": "138****8000",
      "nickname": "小明",
      "avatarUrl": "https://cdn.example.com/avatars/u_abc123.png"
    },
    "deviceSessionId": "web_chrome_e4f9..."
  },
  "requestId": "req_20260901_002"
}
```

> ⚠️ 同时响应头会 `Set-Cookie: refresh_token=<7d JWT>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=604800`；
> 前端无法通过 JS 读取 refresh_token，所有刷新通过带 Cookie 的 `/refresh` 完成（落实 FR-010）。

| data 字段 | 类型 | 说明 |
|----------|------|------|
| accessToken | string | 2h JWT；前端仅存内存变量，不得写入持久化存储 |
| accessTokenExpiresAt | string | Access 过期时间；前端可据此提前 1 分钟触发 refresh |
| user.userId | string | 用户唯一 ID，前端用作用户态主键 |
| user.phoneMasked | string | 脱敏手机号；用于显示，绝不可返回明文 |
| user.nickname / avatarUrl | string | 展示用个人信息；avatar 为空时返回 `""`，前端走默认头像 |
| deviceSessionId | string | 最终确认的会话 ID（可能是后端生成值） |

### 可能失败

| code | 触发条件 | 对应 SecurityLog eventType |
|------|---------|---------------------------|
| 10001 | phone 不合法 | MALICIOUS_INPUT_DETECTED |
| 10003 | 验证码过期 > 5 分钟 | LOGIN_FAIL_INVALID_CODE |
| 10004 | 验证码不匹配（1~4 次） | LOGIN_FAIL_INVALID_CODE |
| 10005 | 验证码错误次数累计 5 | LOGIN_FAIL_INVALID_CODE |
| 10006 | 密码不匹配 或 该手机号未注册（同文案防枚举） | LOGIN_FAIL_ENUM_PROTECTION |
| 10007 | 密码错误累计 10 次（30 分钟锁定） | LOGIN_FAIL_LOCKED |
| 10008 | 缺少必填字段（配合 errors[]） | MALICIOUS_INPUT_DETECTED |
| 10009 | 触发 IP/手机号限流阈值 | RATE_LIMIT_HIT |
| 10010 | 字段危险字符 / encryptedPassword 解密失败（但按 10006 返回给用户，内部记 10010） | MALICIOUS_INPUT_DETECTED |

---

## 3. 静默刷新 Access Token

```
POST /api/v1/auth/refresh
Authorization: (无，依赖 Cookie 中的 refresh_token)
Cookie: refresh_token=<7d JWT>
```

### 请求体（空或带可选 deviceSessionId）

```json
{}
```

### 成功响应（HTTP 200）

同 LOGIN 成功响应结构，但 `user` 字段可省略。若省略则前端保留现有 user。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "accessToken": "eyJhbGciOi...NEW...",
    "accessTokenExpiresAt": "2026-09-01T13:00:00.000Z"
  },
  "requestId": "req_20260901_003"
}
```

> 同时响应头 `Set-Cookie` 下发**新的** refresh_token；旧 refresh_token 被标记 REVOKED + 记入 SecurityLog TOKEN_REFRESHED。

### 失败（HTTP 401）

| code | 说明 | 前端动作 |
|------|------|---------|
| 10011 | Refresh Token 已过期 7 天 | 清除 user + AccessToken，跳 `/login?expired=1` |
| 10012 | Refresh Token 被吊销（改密/风控/登出）或签名被篡改 | 同上 |

---

## 4. 主动登出

```
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

### 请求体（可选是否全局登出）

```json
{
  "allDevices": false
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| allDevices | boolean | ❌（默认 false） | `false`：仅当前 deviceSessionId 令牌吊销；`true`：该 userId 下所有 Refresh Token 全部吊销 |

### 成功响应（HTTP 200）

```json
{
  "code": 0,
  "message": "ok",
  "data": { "loggedOutAt": "2026-09-01T10:05:00.000Z" },
  "requestId": "req_20260901_004"
}
```

> 响应头 `Set-Cookie: refresh_token=; ... Max-Age=0` 主动擦除 Cookie。

### 失败（HTTP 401）

Access Token 过期或无效 → code 10011/10012，前端按前述规则清理本地态并跳登录。

---

## 5. 接口与 Spec 条款双向追溯表

| Spec 条款 | 覆盖的接口 & 字段 |
|----------|------------------|
| FR-001 手机号合法性 | SEND_SMS / LOGIN: phone 正则 `^1[3-9]\d{9}$` → code 10001 |
| FR-002 60s 冷却 + 6 位验证码 | SEND_SMS: cooldownSeconds=60 + code=10002 冷却拦截；LOGIN: code 6 位 `^\d{6}$` |
| FR-003 5min 过期 / 错误 5 次锁定 | LOGIN: code 10003 过期；10004 错误计数；10005 达 5 次锁手机号 10min |
| FR-004 密码前端加密 + 非明文 | LOGIN: encryptedPassword Base64(RSA-2048)；响应仅 phoneMasked，无明文手机号/密码 |
| FR-005 返回用户信息 + 令牌 | LOGIN success: user + accessToken + Refresh Set-Cookie |
| FR-006 令牌过期/篡改拦截 | 所有需鉴权接口：401 → code 10011/10012 + 前端守卫动作 |
| FR-007 入参非法入口拦截 | 所有接口 Zod 校验 + 危险字检测 → code 10010；SecurityLog 事件不落核心业务 |
| FR-008 频控（IP 20/min、phone 10/hr） | SEND_SMS + LOGIN → code 10009；滑动窗口计数写入 Redis |
| FR-009 密码 10 次 → 锁定 30min | LOGIN: code 10007；User.accountStatus=LOCKED，lockedUntil=now+30min |
| FR-010 Refresh Token 安全持久化 | LOGIN/REFRESH 的响应头 Set-Cookie: HttpOnly; Secure; SameSite=Lax；Access 仅内存 |
| P3 US3 限流拦截 | code 10009；配合 RATE_LIMIT_HIT SecurityLog |
| P3 US4 恶意参数拦截 | code 10010；MALICIOUS_INPUT_DETECTED SecurityLog 写 details（不含明文敏感） |
| Edge Cases: 防未注册枚举 | 未注册手机号和密码错误统一返回 code 10006，不做区分 |

---

## 6. 前端 Schema 对齐（Zod 伪代码）

前后端使用同一套字段约束。此处给出前端 Zod 片段供实现对照：

```ts
// schemas/loginSchema.ts
export const sendSmsSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '10001'),
  scenario: z.literal('LOGIN'),
});

export const loginSchema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, '10001'),
  code: z.string()
    .regex(/^\d{6}$/, '10004')
    .refine((v) => !/^(\d)\1{5}$/.test(v) && !['123456','654321','234567','765432'].includes(v), '10004'),
  encryptedPassword: z.string().min(1, '10008'),
  deviceSessionId: z.string().uuid().optional(),
});
```

实现阶段要求：后端 DTO 与前端 Zod 同一源（例如 monorepo `packages/shared-schemas`），确保一处改动全链路生效，避免前端显示"通过"而后端"被拦截"的不一致体验。
