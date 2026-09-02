# Quickstart: 手机号验证码登录 端到端验证指南

**Created**: 2026-09-01
**Feature Spec**: [spec.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/spec.md)
**Implementation Plan**: [plan.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/plan.md)
**Data Model**: [data-model.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/data-model.md)
**Contracts**: [contracts/auth-endpoints.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/contracts/auth-endpoints.md)

---

## 文档定位

本文件是**验证/运行指南**，不是代码实现文档。
目标读者：QA、产品验收、集成测试工程师、Code Reviewer。
目标：在不看源代码的情况下，按照本指南的步骤即可验证该功能是否满足 spec 中的 FR-001~FR-010、SC-001~SC-006、以及 12 条 Given-When-Then 场景。

实现细节（组件代码、迁移脚本、完整测试套件）由后续 `tasks.md` 和 `/speckit-implement` 阶段产出。

---

## 1. 前置条件

### 1.1 环境与依赖

| 依赖 | 版本要求 | 验证方式 |
|------|---------|---------|
| 浏览器 | Chrome / Firefox / Safari 最近 2 个稳定版本 | 打开登录页无报错 |
| Node.js | 20 LTS（若本地启动前后端） | `node -v` → 20.x |
| Redis | 7.x（验证码 / 限流 / 令牌吊销列表） | `redis-cli ping` → `PONG` |
| 关系型数据库 | MySQL 8 或 PostgreSQL 16（User 表 + SecurityLog） | 可登录，并存在至少 1 个已注册测试账号 |
| 短信通道 | 测试环境可用的短信提供商（或提供测试手机号白名单 + 固定验证码） | 白名单手机号 `13800000000` 的固定验证码 `135792` 可用于本地自动化 |
| RSA 密钥对 | 后端持有私钥；前端可通过 `/api/v1/auth/public-key` 或静态 PEM 获取公钥 | `curl /api/v1/auth/public-key` 返回 2048 位公钥 |

### 1.2 测试账号准备

在数据库中预置以下 4 个账号（或通过其他注册流程创建，如注册不在本次范围内，可用 DB 种子脚本直接插入）：

| 用途 | 手机号 | 明文密码 | 备注 |
|------|--------|---------|------|
| 正常登录 | `13800000001` | `Password123!` | accountStatus=ACTIVE，无锁定 |
| 密码即将锁 | `13800000002` | `Password123!` | passwordErrorCount=9，用于验证第 10 次触发锁定 |
| 已锁定 | `13800000003` | `Password123!` | accountStatus=LOCKED，lockedUntil=now+20 分钟 |
| 未注册（防枚举） | `13800000099` | — | 数据库中**不存在**此手机号的 User 行 |

短信通道侧约定：以上 4 个手机号在本地/测试环境（`NODE_ENV !== production`）中，验证码统一固定为 `135792`（避免 QA 收不到短信而卡住验收；本地 `npm run dev` 直接可用）。

### 1.3 启动命令（参考）

> 本章节为验证场景服务，不涉及具体代码实现。tasks 阶段会产出精确的 package.json 脚本与 Docker Compose。

```bash
# 1) 启动 Redis / MySQL（docker-compose 作为参考，tasks 阶段完善）
docker-compose up -d redis mysql

# 2) 启动后端（监听 3001）
cd backend && npm run dev

# 3) 启动前端 Vite dev server（监听 5173，代理 /api 到 3001）
cd frontend && npm run dev
```

健康检查：
- `curl http://localhost:3001/api/v1/auth/public-key` → 返回 200 + JSON 含 `kid` + `pem`
- 浏览器访问 `http://localhost:5173/login` → 看到登录表单，无 console 错误

---

## 2. 核心验证场景（对齐 Spec User Stories）

### 场景 1：P1 正向 — 正常完成登录并保持状态

对应：spec P1 User Story 1 的 3 条验收场景。

| 步骤 | 操作 | 预期结果 | 关联 FR / SC |
|------|------|---------|-------------|
| 1 | 打开 `/login` 页 | 表单含 3 个输入：手机号、验证码（输入框右侧附"获取验证码"按钮）、密码；页面 LCP < 1.5s；输入框带可见 label；Tab 顺序 Phone → 获取验证码 → Code → Password → 登录按钮（键盘可达） | SC-001, A11y |
| 2 | 手机号填 `13800000001`，点击"获取验证码" | 按钮文案变为 `59s 后重新获取`，60 秒内再次点击无反应，按钮 aria-disabled=true；浏览器网络面板 POST `/send-sms` 返回 HTTP 200，`data.cooldownSeconds = 60` | FR-002, FR-008 |
| 3 | 验证码填 `135792`，密码填 `Password123!`，回车或点"登录" | 1 秒内跳转到受保护首页 `/dashboard`；右上角展示 `昵称` `头像`；`phoneMasked = 138****0001`；**localStorage/sessionStorage 中无 access_token**（仅内存）；Network 中 `Set-Cookie` 有 `refresh_token; HttpOnly; Secure` | FR-004, FR-005, FR-010 |
| 4 | 按 Cmd/Ctrl+R 强制刷新页面 | 仍停留在 `/dashboard`，顶部昵称依旧显示；Network 面板可见 1 次 `/refresh` 调用返回 200，页面无闪跳 / 无 Loading 抖动 | SC-006, Perf |
| 5 | 复制当前页面 URL 到新的无痕窗口打开 | 自动跳转到 `/login`，并显示 toast："登录状态已过期，请重新登录"（带 requestId） | FR-006, P3 US1 |

### 场景 2：P2 输入校验 — 每类非法输入即时拦截、友好提示

对应：spec P2 User Story 2 的 5 条场景。

| 子场景 | 操作 | 预期结果 | 关联 |
|--------|------|---------|------|
| 非法手机号 | 输入 `12345` 或 `abc` 后 blur / 点登录 | 手机号输入框红边；下方文字："请输入正确的 11 位手机号"；aria-describedby 绑定该错误文字（屏幕阅读器朗读）；**登录按钮 disabled**；Network 无登录请求发出；耗时 < 200ms | FR-001, SC-003, A11y |
| 验证码过期 | 发送验证码 → 等待 5 分 01 秒（或通过测试脚本直接改 Redis TTL）→ 填 `135792` + 正确密码 → 提交 | `/login` 返回 code=`10003`；验证码框下方提示："验证码已过期，请重新获取"；获取验证码按钮恢复可点击（不再倒计时） | FR-003 |
| 验证码错误 5 次 | 填 `000000` 连续 5 次提交 | 第 1~4 次：code=`10004` 提示"验证码错误，请重新输入"；第 5 次：code=`10005` 提示"错误次数过多，请 10 分钟后重试"；10 分钟内即使改为正确 `135792` 也被 10005 拦截 | FR-003 V-06 |
| 密码错误 10 次锁定 | 用账号 `13800000002`（pre-errorCount=9）填错 1 次密码 | 第 1 次就触发 code=`10007`；文案："密码错误次数过多，账号已临时锁定，请 30 分钟后重试或找回密码"；此时改为正确密码也无法登录（持续 30 分钟） | FR-009 V-05 |
| 空值提交 | 什么都不填直接点登录 | 三个输入框均提示"此项为必填项"；Network 无请求；错误提示与各自字段绑定 | P2 Scenario 5 |

### 场景 3：P3 安全防御 — 限流 / 令牌失效 / 恶意入参

对应：spec P3 User Story 3 的 4 条场景。

| 子场景 | 操作 | 预期结果 | 关联 |
|--------|------|---------|------|
| 令牌过期自动退出 | 正常登录 → 测试脚本把 Access Token 的 exp 改成 1 秒前（或后端手动调接口）→ 访问任意 `/api/v1/me` 接口 | 前端拦截到 401 → 静默调 `/refresh`；若 Refresh 也过期 → 清除本地态 + 跳 `/login` + toast"登录状态已过期"；Network 中 refresh_token Cookie 被 `Max-Age=0` 清空 | FR-006, P3 US1 |
| 令牌被篡改 | 正常登录 → 用 Chrome DevTools 修改 Authorization 请求头为假字符串（或用 Burp 改包）→ 触发接口请求 | 同"令牌过期"：401 → refresh 失败 → 清态跳登录；SecurityLog 记录 `TOKEN_REVOKED` / `MALICIOUS_INPUT_DETECTED` | P3 US2 |
| 限流触发 | 写 shell 脚本在 1 分钟内向 `/send-sms` 发起 25 次请求（同一 IP，同一手机号 `13800000001`） | 第 1~20 次正常；第 21~25 次 HTTP 429，code=`10009`，提示"操作过于频繁，请稍后重试"；SecurityLog 记录 `RATE_LIMIT_HIT`；Redis 中滑动窗口计数正确 | FR-008 V-07, P3 US3 |
| 恶意参数拦截 | 发送 `POST /login`，body：`{"phone":"1' OR '1'='1","code":"135792","encryptedPassword":"<script>alert(1)</script>"}` | 接口返回 400，code=`10010`，message="请求包含非法参数，请检查输入内容"；业务核心函数（bcrypt 比对 / 发验证码）**未被执行**；SecurityLog 写入 `MALICIOUS_INPUT_DETECTED`，details 中不含明文密码 | FR-007, P3 US4 |

### 场景 4：未注册手机号防枚举

对应 spec Edge Cases 第 5 条。

| 步骤 | 操作 | 预期结果 | 关联 |
|------|------|---------|------|
| 1 | 用未注册手机号 `13800000099` + 正确验证码 `135792` + 任意密码提交 | 接口响应 code=`10006`，文案"密码错误，请重试"，与"正确手机号但密码不对"的错误**完全相同**（延迟也一致，避免时序侧信道） | Edge Case 5, V-11 |
| 2 | 对比：注册手机号 `13800000001` 故意填错密码 | 接口响应同步骤 1：code=10006 / message / 响应延迟差值 ≤ 30ms | 防时序枚举 |

---

## 3. 自动化测试运行（本地验收）

本文件不包含完整测试代码，但给出可执行的命令入口（tasks 阶段会补齐文件路径）。QA 可按以下命令一键跑通：

```bash
# 进入前端目录
cd frontend

# 1) 单测：业务逻辑 80% 覆盖率 / Zod + Security 100%
npm run test:unit -- --coverage
# 期望终端输出：
#   loginSchema.spec.ts ✓
#   rsaCrypto.spec.ts    ✓
#   SecurityService      ✓  -> 100% Statements / Branches

# 2) 集成测试：MSW mock 后端，覆盖 12 条验收场景
npm run test:integration
# 期望：LoginForm.test.tsx 全部通过，特别是 5 类 P2 错误提示文案精确匹配

# 3) E2E：Playwright 真浏览器端到端
npm run test:e2e
# 期望：auth-login.spec.ts 中 17 条用例（12 scenario + 5 edge cases）全部 PASS
# 附带：@axe-core/playwright 断言登录页 /dashboard 均 WCAG 2.1 AA 通过（无 a11y 严重违规）

# 4) A11y + 视觉：Storybook 快照 & axe
npm run storybook:test
# 期望：5 个组件（PhoneInput/CodeInput/PasswordInput/CountdownButton/LoginForm）
#       axe-core 0 violations；视觉快照无 Layout Shift（CLS 合规）
```

### 3.1 覆盖率门禁（Constitution 合规）

```
npm run typecheck    # TS strict: PASS, 0 any
npm run lint         # ESLint + Prettier: 0 warnings, 0 errors
npm run build        # Vite build success, 首屏 chunk < 180KB (gzipped)
```

若上述 5 条任一不通过，视为**未通过本 Quickstart 验收**，不得进入 Code Review。

---

## 4. 性能 & 安全抽样核验（对应 SC）

QA / 安全团队可额外做如下**抽样核验**，不必每轮回归都跑，但上线前必须有至少 1 次通过记录：

### 4.1 SC-005 登录接口 P95 < 300ms

```bash
# 使用 k6 打 100 QPS，持续 60 秒
k6 run -e BASE_URL=http://localhost:3001 scripts/load-test-login.js
# 验收：p(95)<300ms、error_rate<0.1%
```

### 4.2 SC-004 渗透：10 类攻击全部拦截

由安全工程师或使用 OWASP ZAP 自动扫描：

| 攻击类 | 测试点 |
|-------|-------|
| JWT 签名伪造 | 用已知公钥伪造算法为 `none` → 预期 401 |
| SQLi | phone 字段 `1' OR 1=1 --` → 预期 400 code 10010 |
| XSS | encryptedPassword 填 `<img src=x onerror=alert(1)>` → 登录页无弹窗、日志无脚本内容原样渲染 |
| Replay | 同一个 code 提交两次 → 第二次 10004 或 10003（USED 状态） |
| Brute Force | 限流下 21/min 次 → 第 21 次 10009 |
| 枚举 | 未注册/已注册响应差异 ≤ 30ms |
| Cookie 丢失 | 删除 refresh_token Cookie 后刷新 → 跳登录 |
| CORS 跨站 | evil.com 发 POST /login → 被 CORS 策略拦截 |
| 暴力锁定 | 密码 10 次错误锁定 → 正确密码也登不上 |
| 点击劫持 | `X-Frame-Options: DENY` + CSP frame-ancestors，不可被 iframe 嵌入 |

### 4.3 SC-002 可用性抽样

招募 5~10 名真实用户首次尝试登录：
- 成功完成任务的比例 ≥ 95%（即最多允许 1 人因提示不清导致重复提交超过 1 次）
- 如有 > 2% 的重复提交，需优化提示文案后回到 Step 2 重新测试

---

## 5. 上线 Checklist（发布前）

| 项 | 责任人 | 验收确认 |
|----|-------|---------|
| 生产 RSA 公钥 kid 与私钥匹配；私钥仅后端可访问 | SRE / 安全 | ✅ / ❌ |
| Redis 生产实例内存配额 ≥ 2GB（验证码 + 限流 + 吊销列表） | SRE | ✅ / ❌ |
| 短信通道签名、模板、限流配置已向供应商报备 | 产品 / 运营 | ✅ / ❌ |
| Playwright 全 17 条 E2E 通过 + axe-core A11y 通过 | QA | ✅ / ❌ |
| k6 100 QPS 压测 P95 < 300ms，error < 0.1% | 后端 / 性能 | ✅ / ❌ |
| 渗透测试 10 类攻击全部被拦截（ZAP 报告归档） | 安全 | ✅ / ❌ |
| Constitution Check（Constitution Check Post-Phase 1）所有条目仍 PASS | 技术负责人 | ✅ / ❌ |
| 错误提示文案（中文）已由产品经理过审，无歧义 | 产品 | ✅ / ❌ |

> 以上任一 ❌ 不得带上线。

---

## 6. 常见问题排查（非代码）

| 现象 | 可能原因 | 排查路径 |
|------|---------|---------|
| "获取验证码"点了没反应 | 前端 Zod 未通过；或 60s 倒计时未重置 | 打开 DevTools → 表单 onSubmit handler 是否被调用；Network 是否有 send-sms 请求 |
| 登录请求发出去立即 400 code 10010 | encryptedPassword 公钥过期；后端 kid 与加密时 kid 不匹配 | 检查 `/public-key` 返回 kid 是否与前端使用的一致；RSA 私钥是否轮换过 |
| 刷新页面就掉线（本应保持） | `/refresh` 接口未正确带 refresh_token Cookie；Cookie Path 错配 | 检查 Response Set-Cookie 的 `Path=/api/v1/auth/refresh` 是否与实际 refresh URL 匹配 |
| 登录后 Lighthouse CLS > 0.1 | 输入框错误提示 placeholder 高度变化；验证码按钮倒计时宽度抖动 | 回到 Step 2 用 Playwright trace viewer 看帧截图，定位抖动 DOM |

---

## 7. 回归测试矩阵

每个 Sprint 回归时，按如下矩阵执行：

- **S（Smoke，每次构建必跑）**：场景 1 步骤 1~3 + 场景 2 空值提交 → Playwright 3 条
- **R（Regression，每日）**：场景 1 全 5 步 + 场景 2 全 5 类 → Playwright 10 条
- **F（Full，发版前）**：本文档第 2、3、4.1、4.2 全部 17+10 → Playwright + k6 + ZAP

通过以上矩阵后，可认为本功能满足 spec 全部 FR/SC，具备上线条件。

**→ 本 Quickstart 完结：下一步进入 tasks 阶段，将以上步骤拆解为可执行代码任务。**
