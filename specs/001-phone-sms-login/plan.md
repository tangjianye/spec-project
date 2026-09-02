# Implementation Plan: 手机号验证码登录

**Branch**: `001-phone-sms-login` | **Date**: 2026-09-01 | **Spec**: [spec.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/spec.md)

**Input**: Feature specification from `specs/001-phone-sms-login/spec.md`

**Note**: This plan is filled in by the `/speckit-plan` command and covers the technical approach, architecture, and research that will drive implementation.

---

## Summary

本功能为中国大陆已注册用户提供"手机号 + 短信验证码 + 密码"的三重安全登录能力，覆盖从获取验证码、提交登录、鉴权续期，到非法入参与失效凭证拦截的完整闭环。

**核心技术路径**（来自 [research.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/research.md)）：

1. **前端**：React 18 + TypeScript strict + Vite；Zustand 管全局登录态，React Router `<RequireAuth>` 守卫；Zod 实时校验手机号/验证码/密码，错误提示 ≤ 200ms。
2. **密码加密**：浏览器 RSA-2048 公钥加密 → 后端私钥解密 → bcrypt 哈希比对 & 入库。
3. **令牌体系**：Access Token（内存，2h JWT）+ Refresh Token（HttpOnly Secure Cookie，7 天），双 Token 静默续期，可主动吊销。
4. **验证码 & 安全层**：Redis 存 5 分钟 TTL 验证码 + 滑动窗口频控（IP 20/min、手机号 10/hr、发送 60s 冷却）；错误累计触发验证码 5 次/10 分钟、密码 10 次/30 分钟锁定。
5. **安全审计**：三层防御（前端 Zod / 网关入参拦截 / SecurityService 策略引擎），所有命中写 SecurityLog。
6. **测试 & 可访问性**：Vitest + RTL 单测、MSW 集成、Playwright E2E 覆盖 12 条场景；Storybook + axe-core CI 断言 WCAG 2.1 AA。

---

## Technical Context

**Language/Version**: TypeScript 5.x (strict: true); Node.js 20 LTS (for backend if project includes one)

**Primary Dependencies**:
- Frontend: React 18, React Router v6, Zustand, Zod, SubtleCrypto (WebCrypto native)
- Data / Cache: Redis 7.x（验证码、限流、错误计数、刷新令牌吊销列表）
- Testing: Vitest, @testing-library/react, MSW, Playwright, @axe-core/playwright

**Storage**:
- 用户账户与密码哈希：关系型数据库（MySQL 8 / PostgreSQL 16，项目已有统一选型即可）
- 验证码、限流计数器、Security 短期状态：Redis 7
- 令牌：Access Token 内存变量；Refresh Token HttpOnly Secure Cookie；吊销列表存 Redis 短 TTL 黑名单

**Testing**: Vitest（unit + integration）+ Playwright（E2E + A11y 断言），覆盖率门槛起码满足宪法：业务逻辑 80%，渲染 60%；SecurityService & Zod schema 强制 100%。

**Target Platform**: 现代浏览器（Chrome 最新 2 版本、Firefox 最新 2 版本、Safari 最新 2 版本 + iOS Safari 16+），单页应用；桌面端 ≥ 1280px，移动端 ≤ 430px 做响应式适配。

**Project Type**: Web Application（前后端分离；前端为 React SPA，后端提供 REST 风格登录相关 API）

**Performance Goals**（来自 spec SC-001 & SC-005）：
- 前端首屏登录页 LCP ≤ 1.5s（低于宪法 2.5s 红线）
- 登录接口 P95 响应时间 ≤ 300ms（100 QPS 稳态）
- 客户端错误提示显示延迟 ≤ 200ms（纯 Zod 校验，不走网络）
- 静默刷新 Access Token 对用户不可见，无 UI 抖动 / 闪白

**Constraints**:
- 严格符合《项目宪法》：规范驱动流程、组件化、性能优先、WCAG 2.1 AA、TS strict
- `any` 类型禁止；ESLint + Prettier 0 warning
- Access Token 不得写入 localStorage / sessionStorage / indexedDB
- 错误提示文案不得泄露"该手机号是否已注册"的信息

**Scale/Scope**: 支持日活 10 万级用户、峰值 100 QPS 登录流量；单用户可同时在最多 5 台设备登录（可吊销单设备）。

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 宪法条款 | 本计划对应落实 | 评估结果 |
|---------|---------------|---------|
| **I. Spec-Driven Development** | plan 逐条对照 spec FR-001~FR-010、SC-001~SC-006，无遗漏；设计严格遵循"先文档后实现" | ✅ PASS |
| **II. Component-First Architecture** | 登录表单拆为 PhoneInput / CodeInput / PasswordInput / CountdownButton / LoginForm 5 个独立可 Storybook 复用组件；业务逻辑抽 `useLogin` hook；状态归 Zustand | ✅ PASS |
| **III. Performance-First** | Vite 代码分割 + 路由懒加载；Access Token 内存避免序列化；RSA 用 WebCrypto 原生；核心指标 LCP/CLS/INP 在测试目标中均有定量值 | ✅ PASS |
| **IV. Accessibility Compliance** | label + htmlFor + aria-describedby 绑定错误；原生 button disabled；axe-core + Storybook 自动化 + Playwright WCAG 断言；键盘 Tab + Enter 流 | ✅ PASS |
| **V. Type Safety & Code Quality** | TS strict；密码加密 util、SecurityService、Zod schema 三处要求 100% 单测；ESLint + Prettier 门禁；无裸 `any` | ✅ PASS |
| **Tech Stack 选型** | React 18 + TS + Vite、TanStack Query (server state)、Zustand (client)、Vitest+RTL、Playwright —— 与宪法完全一致 | ✅ PASS |
| **Quality Gates** | 本计划产物均为下一步 tasks 中写入 CI 六项门禁的依据（类型检查 / 单测集成测 / ESLint / 构建 / A11y / Playwright E2E） | ✅ PASS |

初始 Constitution Check **8/8 PASS**。Phase 1 设计结束后会再次复核。

---

## Project Structure

### Documentation (this feature)

```text
specs/001-phone-sms-login/
├── plan.md              # this file
├── research.md          # Phase 0 — 8 项技术决策（已生成）
├── data-model.md        # Phase 1 — User / SmsCode / AuthToken / SecurityLog 实体
├── quickstart.md        # Phase 1 — 端到端验证指南
├── contracts/           # Phase 1 — API 接口契约（请求/响应/错误码/字段校验）
│   └── auth-endpoints.md
├── checklists/
│   └── requirements.md  # speckit-specify 质量检查表（已存在）
└── tasks.md             # Phase 2 — /speckit-tasks 生成（本阶段不创建）
```

### Source Code (repository root)

```text
frontend/
├── public/
│   └── login-rsa-pub.pem        # 后端签发的 RSA 公钥（或接口拉取，二选一）
├── src/
│   ├── app/
│   │   ├── App.tsx              # 根组件 + Router + <AxiosInterceptor>
│   │   └── routes.tsx           # 路由定义 + <RequireAuth> 守卫挂载
│   ├── features/
│   │   └── auth/
│   │       ├── components/
│   │       │   ├── PhoneInput.tsx
│   │       │   ├── CodeInput.tsx
│   │       │   ├── PasswordInput.tsx
│   │       │   ├── CountdownButton.tsx  # "获取验证码"按钮
│   │       │   └── LoginForm.tsx        # 组合以上 + 提交逻辑
│   │       ├── hooks/
│   │       │   ├── useCountdown.ts      # 60 秒倒计时
│   │       │   └── useLogin.ts          # 登录表单状态 & 提交流
│   │       ├── schemas/
│   │       │   └── loginSchema.ts       # Zod 手机号/验证码/密码 schema
│   │       ├── services/
│   │       │   ├── authApi.ts           # 验证码 + 登录 + 刷新 + 登出
│   │       │   └── rsaCrypto.ts         # WebCrypto RSA 加密
│   │       ├── store/
│   │       │   └── useAuthStore.ts      # Zustand：user + token(内存) + 动作
│   │       ├── guards/
│   │       │   └── RequireAuth.tsx      # 路由守卫：refresh → 清态跳登录
│   │       └── types/
│   │           └── auth.types.ts        # User / Tokens / Errors
│   ├── shared/
│   │   ├── components/                  # 通用输入、按钮、toast（项目已有则复用）
│   │   ├── services/
│   │   │   └── http.ts                  # Axios 实例 + 401 刷新拦截器
│   │   └── utils/
│   │       └── phoneFormat.ts           # 11 位手机号校验/格式化
│   └── main.tsx
├── .storybook/
│   └── stories/auth/*.stories.tsx       # Login 5 个组件 + a11y 参数
└── tests/
    ├── unit/
    │   ├── schemas/loginSchema.test.ts
    │   ├── services/rsaCrypto.test.ts
    │   └── hooks/useCountdown.test.ts
    ├── integration/
    │   ├── mocks/handlers.ts            # MSW mock 验证码/登录/刷新
    │   └── LoginForm.test.tsx           # 12 条验收场景的集成覆盖
    └── e2e/
        └── auth-login.spec.ts           # Playwright 12 场景 + 5 边界 + WCAG

# 如项目包含后端（与前端同仓）：
backend/
├── src/
│   ├── modules/auth/
│   │   ├── auth.controller.ts       # 发送验证码 / 登录 / 刷新 / 登出
│   │   ├── auth.service.ts          # 业务编排：验证→签发→写日志
│   │   ├── security.service.ts      # 频控 + 错误累计 + 锁定 + 入参危险字
│   │   ├── sms.service.ts           # 调用三方短信 + 验证码写入 Redis
│   │   └── dto/                     # Zod 校验 DTO（与前端 schema 对齐）
│   ├── modules/user/
│   │   ├── user.entity.ts           # 账户实体（手机号哈希、密码 bcrypt、锁定）
│   │   └── user.service.ts
│   └── common/
│       ├── redis/                   # Redis client & keys
│       └── filters/                 # 统一错误响应 & SecurityLog 写入
└── tests/
    └── e2e/auth.spec.ts             # 后端单测：登录锁定、限流、错误计数
```

**Structure Decision**:
选用 **Option 2: Web application (frontend + backend)** 结构，因为本功能既涉及 React 登录表单，又包含服务端验证码签发/校验、令牌、安全策略，前后端分离目录能清晰隔离职责，便于 tasks 阶段将任务拆为"前端 FE-*"和"后端 BE-*"并行推进。目录命名保持项目通用风格（`frontend/src/features/auth/…`、`backend/src/modules/auth/…`），方便设计系统组件、通用 HTTP 工具在多 feature 间复用。

---

## Complexity Tracking

> 本次宪法检查全部通过。若在 Phase 1 设计后出现新增复杂度再于此填写。当前无条目，保留占位用于后续增补。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| —（暂无） | — | — |

---

## Constitution Check (Post-Phase 1 Re-evaluation)

*在 Phase 1 设计（data-model + contracts + quickstart）完成后重新确认是否仍符合宪法。填写完成后本栏更新为 PASS 或列出补充违规及 Complexity Tracking 条目。*

→ **PASS（待 Phase 1 结束后复核并打最终勾选）**
