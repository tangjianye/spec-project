# Data Model: 手机号验证码登录

**Created**: 2026-09-01
**Feature**: [spec.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/spec.md)
**Plan**: [plan.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/plan.md)

---

## 概览

本功能涉及 4 个核心实体：`User`（账户主体）、`SmsCode`（验证码）、`AuthToken`（登录令牌）、`SecurityLog`（安全审计日志）。
它们之间的关系是：一个 User 可以有多条 SmsCode 请求记录、多个并行有效的 AuthToken（对应多端登录）、多条 SecurityLog 事件。

实体划分严格对齐 spec 中 "Key Entities" 章节的业务描述，不包含具体实现字段（不出现 `redis_key`、`db_table`、`varchar(50)` 等实现细节），但会指明校验规则、状态迁移、TTL、关系基数等可被自动化验证的约束。

---

## 1. User（账户主体）

### 职责与标识

代表系统中的一个自然人账户，是登录鉴权的主体。以 `userId`（用户唯一标识，UUID 或雪花 ID）为不可变主键；
`phone` 为登录入口识别凭据，因属敏感个人信息在存储层以不可逆或可检索哈希方式保存。

### 核心属性（业务视角）

| 字段 | 业务语义 | 约束 / 校验 |
|------|---------|------------|
| userId | 用户唯一 ID，跨端不变 | 全局唯一，创建后不可改 |
| phone | 11 位中国大陆手机号（用户登录主标识） | 正则 `^1[3-9]\d{9}$`；对未注册手机号的查询不得在响应中暴露存在性（防止枚举） |
| nickname | 用户昵称（登录成功后返回） | 非空，长度 2~20 字符（中文/英文/数字） |
| avatarUrl | 头像地址 | 可选；若为空则前端展示默认头像 |
| passwordHash | 密码校验凭据（非明文） | 由 bcrypt/同类算法产出；强度要求同前端密码校验：密码明文长度 ≥ 8；同一账号修改密码后，此前所有未过期 Refresh Token 自动吊销 |
| accountStatus | 账号状态枚举 | `ACTIVE`（可正常登录）/ `LOCKED`（临时锁定，不接受密码登录）/ `DISABLED`（长期停用，所有登录入口均拒绝） |
| lockedUntil | 当 accountStatus=LOCKED 时的锁定截止时间 | FR-009 要求：连续密码错误 10 次 → 锁定 30 分钟 |
| passwordErrorCount | 密码错误累计计数器 | 每 1 次密码错误 +1；登录成功或锁定解除重置为 0；达到 10 触发锁定 |

### 关系

- 1 个 User ↔ N 条 SmsCode（按手机号维度计数，但只对当前最新 1 条有效）
- 1 个 User ↔ N 条 AuthToken（默认最多 5 台设备；超阈值后最早签发且仍有效的 1 条被自动吊销）
- 1 个 User ↔ N 条 SecurityLog

### 状态迁移

```
ACTIVE
  ├── 连续密码错误达 10 次 ──▶ LOCKED（30 分钟倒计时）
  │        └── lockedUntil 到达 ──▶ ACTIVE（并重置 passwordErrorCount）
  └── 人工风控 / 停用 ──▶ DISABLED（仅管理员可恢复）
```

---

## 2. SmsCode（短信验证码）

### 职责与标识

用于用户在登录流程中的"第二因素"校验：证明用户确实持有该手机号的 SIM 卡。每条 SmsCode 仅在有限的时间窗口内可被成功使用一次，过期或用过即作废。以 `phone + scenario(=login)` 为业务主键，最新一条有效。

### 核心属性（业务视角）

| 字段 | 业务语义 | 约束 / 校验 |
|------|---------|------------|
| phone | 目标手机号 | 同 User.phone 正则；每次发送前都要校验 |
| scenario | 场景枚举 | `LOGIN`（本功能只支持登录场景；预留注册、改密等） |
| code | 6 位数字验证码 | 长度严格 6 位；不能是 6 个相同数字（如 000000）、不能是连续递增/递减（123456 / 654321）；传输和存储均用哈希，永不回显明文 |
| createdAt | 发送时间 | 精确到秒 |
| expiresAt | 过期时间 | FR-003：创建后 5 分钟（即 createdAt + 300s） |
| usedAt | 使用时间 | 成功验证时写入；若已 usedAt 非空则再次校验直接失败 |
| resendKey | 同手机号再次发送的冷却标识 | FR-002：同 phone+scenario 发送后，60 秒内不能重发 |
| verifyErrorCount | 验证码错误次数 | 每校验失败 1 次 +1；达到 5 次该验证码立即作废，且 FR-003：phone+scenario 10 分钟内不得再次尝试验证码登录 |

### 业务规则

1. **最新唯一**：同一个 phone + scenario 再次发送新验证码 → 旧的那条（若仍有效）被标记为"SUPERSEDED"，立即失效，避免用户两条短信都能登录。
2. **频控门槛**：发送前必须通过 FR-008 两层限流：
   - 发送方 IP：1 分钟 ≤ 20 次
   - 手机号维度：1 小时 ≤ 10 次
3. **错误提示语义**：
   - 过期 → 返回"验证码已过期"
   - 错码 → 返回"验证码错误，请重新输入"
   - 超过错误次数 → 返回"错误次数过多，请 10 分钟后重试"
   以上所有错误计数都写入 SecurityLog。

### 生命周期（状态迁移）

```
ISSUED（已发送，未使用，未过期）
  ├── 5 分钟到 ──▶ EXPIRED（自动失效）
  ├── 收到新的同 phone+scenario 发送 ──▶ SUPERSEDED（立即作废）
  ├── 第 1~4 次校验失败 ──▶ verifyErrorCount++，仍为 ISSUED
  ├── 第 5 次校验失败 ──▶ TOO_MANY_ATTEMPTS（立即作废，并打 10 分钟手机号侧锁定）
  └── 校验成功（验证码正确 + 未过期 + 未使用） ──▶ USED（写 usedAt，仅此一次）
```

---

## 3. AuthToken（登录令牌）

### 职责与标识

代表"某用户在某设备/会话上已完成身份校验"的凭据。采用双 Token 方案：
- **Access Token**：短期有效（2 小时），仅放内存，用于每次请求鉴权。
- **Refresh Token**：长期有效（7 天），放在 HttpOnly Secure Cookie 中，仅用于静默续期和登出吊销。

每条 AuthToken 以 `jti`（JWT ID）为唯一标识，便于精确吊销。

### 核心属性（业务视角）

| 字段 | 业务语义 | 约束 / 校验 |
|------|---------|------------|
| tokenKind | 令牌类型 | `ACCESS` 或 `REFRESH`。一个登录动作签发 1 对（同一 jti 关联）。 |
| jti | 令牌唯一 ID | 全局唯一。被列入黑名单后，即使用户持有也视为失效。 |
| userId | 所属用户 | 签发时绑定，不可变更。 |
| deviceSessionId | 设备/会话标识 | 同一用户多端登录时用于区分；支持"仅吊销某一设备的令牌"（后续迭代）。 |
| issuedAt | 签发时间 | 用于判断是否在改密码时间之后（改密码前签发的所有 Refresh Token 全部失效）。 |
| expiresAt | 过期时间 | ACCESS：2h；REFRESH：7d。过期后任何接口使用都视为失效。 |
| status | 状态 | `ACTIVE` / `REVOKED` / `EXPIRED`。REVOKED 可由登出/改密/风控触发。 |
| revokedReason | 吊销原因枚举 | `USER_LOGOUT` / `PASSWORD_CHANGED` / `ADMIN_KICKED` / `SECURITY_RISK` |

### 关系

- 每条 AuthToken（ACCESS + REFRESH 一对）对应一个 User + 一个 deviceSessionId
- 每次 `/auth/refresh`：原 REFRESH 消耗 → 签发新的一对 token（新 jti）

### 业务规则

1. **失效触发**：
   - 到达 expiresAt → 自动 EXPIRED
   - 用户点"退出登录" → 对应 jti 的 ACCESS + REFRESH 都写入吊销黑名单
   - 用户修改密码成功 → 该 userId 下所有 ACTIVE 状态的 Refresh Token 立即 REVOKE（PASSWORD_CHANGED）
2. **校验规则（所有需鉴权接口统一）**：
   - Access Token 存在且签名合法 + status=ACTIVE + 未过期 → 通过
   - 任意条件不满足 → 返回 401，前端拦截器尝试 refresh；refresh 失败 → 清态跳登录（落实 P3 US1/US2）
3. **数量上限**：同一 userId 下 ACTIVE Refresh Token 数 > 5 时，按 issuedAt 排序吊销最早的 1 条，维持上限。

### 状态迁移

```
ACTIVE
  ├── expiresAt 到达 ──▶ EXPIRED（自然过期）
  ├── 用户登出 ──▶ REVOKED（USER_LOGOUT）
  ├── 用户改密 ──▶ REVOKED（PASSWORD_CHANGED，同 userId 所有）
  ├── 管理员/风控 ──▶ REVOKED（ADMIN_KICKED / SECURITY_RISK）
  └── refresh 消费旧 REFRESH ──▶ REVOKED + 签发新的 ACTIVE 一对
```

---

## 4. SecurityLog（安全审计日志）

### 职责与标识

对所有登录相关安全事件进行**不可变**的审计记录。用于 FR-004 / FR-007 / FR-008 / FR-009 / P3 US4 等要求的事后追溯与安全合规。
每条 SecurityLog 以 `eventId`（自增或 UUID）为主键，写入后只许追加不许修改。

### 核心属性（业务视角）

| 字段 | 业务语义 | 约束 / 校验 |
|------|---------|------------|
| eventId | 审计事件 ID | 主键，不可变 |
| eventType | 事件类型枚举 | `SMS_SEND_ATTEMPT`、`SMS_SEND_OK`、`SMS_SEND_BLOCKED_RATE_LIMIT`、`LOGIN_ATTEMPT`、`LOGIN_OK`、`LOGIN_FAIL_INVALID_CODE`、`LOGIN_FAIL_INVALID_PASSWORD`、`LOGIN_FAIL_LOCKED`、`LOGIN_FAIL_ENUM_PROTECTION`、`RATE_LIMIT_HIT`、`TOKEN_REFRESHED`、`TOKEN_REVOKED`、`MALICIOUS_INPUT_DETECTED` |
| actorType | 触发主体类型 | `USER`（已登录，写 userId）/ `ANONYMOUS`（未登录，只写 phone 哈希）/ `SYSTEM`（定时任务/风控） |
| actorRef | 主体引用 | userId 或 phoneHash（视 actorType 而定），**日志中不可写入明文手机号** |
| clientIp | 触发来源 IP | 支持 IPv4 / IPv6 |
| userAgent | 客户端 UA 摘要 | 可用于识别设备 / 爬虫，写入前做长度截断（≤ 512 字符）并移除危险子串（避免 XSS 日志注入） |
| result | 事件结果 | `ALLOWED` / `BLOCKED` / `ERROR` |
| details | 结构化详情 JSON | 如限流命中阈值、错误次数累计值、被吊销的 jti 列表等；key 白名单化，不允许写入明文验证码和明文密码 |
| createdAt | 事件发生时间 | 精确到毫秒；所有 SecurityLog 默认按该字段倒序展示 |

### 业务规则

1. **敏感字段保护**：details 中的 `code` / `password` 字段必须为空或被打码（如 `****`），绝不落明文。
2. **事件完整性保证**：对于 FR-007 类"入口层拦截"的事件（MALICIOUS_INPUT_DETECTED），即使核心业务流程未执行也要先落日志。
3. **查询/导出权限**：SecurityLog 仅安全合规管理员可查询；普通业务接口不得读取。

### 与其他实体的关系

- 1 次登录尝试 → 1 条 LOGIN_ATTEMPT + 最终 1 条 LOGIN_OK / LOGIN_FAIL_* 记录
- 1 次 MALICIOUS_INPUT_DETECTED → 对应 P3 US4 的恶意请求拦截证据
- 1 次 TOKEN_REVOKED → 对应 AuthToken.status 迁移到 REVOKED 的同步记录

---

## 实体关系图（业务视角）

```
┌───────────────┐           ┌───────────────┐
│     User      │ 1       N │    SmsCode    │
│ (userId, PK)  │──────────▶│(phone+scenario│
│ accountStatus │           │  biz key)     │
│ passwordHash  │           │ expiresAt,    │
└───────┬───────┘           │ verifyErrorCnt│
        │                   └───────────────┘
        │ 1
        │
        ▼ N
┌──────────────────────────────────┐        ┌─────────────────┐
│           AuthToken              │ N    1 │   SecurityLog   │
│ (jti, PK)  ACCESS + REFRESH pair │───────▶│ (eventId, PK)   │
│ userId, deviceSessionId          │        │ eventType,      │
│ issuedAt / expiresAt / status    │        │ actorRef,       │
└──────────────────────────────────┘        │ clientIp, result│
                                            └─────────────────┘
```

---

## 关键校验规则汇总（实现阶段任务化引用清单）

| 编号 | 规则 | 对应 spec 条款 |
|------|------|---------------|
| V-01 | 手机号正则 `^1[3-9]\d{9}$`；不合法阻止提交 | FR-001 |
| V-02 | 验证码 6 位数字 + 非弱码（非同号/非连续）；发送前 | FR-002 / FR-003 |
| V-03 | 验证码有效期 5 分钟；一次使用；60 秒重发冷却 | FR-002 / FR-003 |
| V-04 | 密码长度 ≥ 8；RSA 公钥加密后传输；后端用 bcrypt 比对 | FR-004 |
| V-05 | 密码错误次数达 10 → LOCKED 30 分钟 | FR-009 |
| V-06 | 验证码错误次数达 5 → phone 10 分钟禁止 | FR-003 |
| V-07 | 同 IP 1 分钟 > 20 次或同 phone 1 小时 > 10 次 → 限流拒绝 | FR-008 |
| V-08 | Access Token 2h；Refresh 7d；改密吊销所有 Refresh | FR-005 / FR-006 |
| V-09 | 令牌过期/篡改 → 清态 + 跳登录 | P3 US1 / US2 |
| V-10 | 恶意入参（SQL 注入/XSS 关键字）在网关层拦截，写 SecurityLog | FR-007 / P3 US4 |
| V-11 | "未注册手机号登录"错误文案 ≡ "密码错误"，防枚举 | Edge Cases 最后一条 |
| V-12 | SecurityLog 禁止落明文密码/明文验证码 | 安全合规（由审计流程保障） |
