# Tasks: 手机号验证码登录

**Input**: Design documents from `specs/001-phone-sms-login/`

**Prerequisites**: [plan.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/plan.md) (required), [spec.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/spec.md) (required for user stories), [research.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/research.md), [data-model.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/data-model.md), [contracts/auth-endpoints.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/contracts/auth-endpoints.md), [quickstart.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/quickstart.md)

**Tests**: 本功能 spec 明确要求可测试性与错误提示即时性，quickstart 定义了完整的 unit/integration/E2E/a11y 测试矩阵，故所有测试任务为必需（非可选）。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/src/`, `frontend/src/`（前后端分离，目录结构见 plan.md）
- 前后端共用校验 schema 放根目录 `packages/shared-schemas/`
- 测试目录：`frontend/tests/{unit,integration,e2e}`、`backend/tests/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化与基础结构

- [x] T001 在仓库根创建 `package.json` + `pnpm-workspace.yaml`，声明 `frontend`、`backend`、`packages/*` workspace（pnpm 8+）
- [x] T002 [P] 初始化前端 Vite + React 18 + TypeScript strict 工程，生成 `frontend/package.json`、`frontend/vite.config.ts`、`frontend/tsconfig.json`（`strict: true`，禁止裸 `any`）
- [x] T003 [P] 初始化后端 Node.js 20 + TypeScript 工程，生成 `backend/package.json`、`backend/tsconfig.json`（`strict: true`），提供 `dev` / `build` / `start` 脚本
- [x] T004 [P] 配置 ESLint + Prettier（根目录 `.eslintrc.cjs`、`.prettierrc`），接入 `eslint-plugin-jsx-a11y`，要求 0 warning 门禁
- [x] T005 [P] 配置环境变量管理：根目录 `.env.example`（含 `REDIS_URL`、`DB_URL`、`SMS_PROVIDER_KEY`、`RSA_PRIVATE_KEY`、`JWT_SECRET`），后端读取 `backend/src/config/env.ts`
- [x] T006 接入 Redis 客户端统一封装：`backend/src/common/redis/redis.ts`（提供 `get/set/setNX/incr/expire/zAdd/zCount` 最小封装），导出单例
- [x] T007 [P] 配置 CI 基础流水线（`.github/workflows/ci.yml` 或项目已有 CI 入口）：typecheck → lint → unit → integration → build 六道门禁占位

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 所有用户故事必须依赖的核心基础设施

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 创建前后端共用校验包 `packages/shared-schemas/`：`phoneSchema`（`^1[3-9]\d{9}$`）、`codeSchema`（6 位数字 + 拒绝 6 个相同数字/连续递增递减）、`loginPayloadSchema`（对齐 contracts §6 Zod 示例），发布为 workspace 包
- [x] T009 后端统一响应信封与错误中间件：`backend/src/common/filters/response-filter.ts`（成功 `{code,message,data,requestId}`）+ `backend/src/common/filters/error-filter.ts`（错误 `{code,message,errors,requestId}`，错误码矩阵见 contracts §0）
- [x] T010 [P] 后端安全策略引擎骨架：`backend/src/modules/auth/security.service.ts`（滑动窗口频控 `zAdd/zCount`、错误累计 `incr`、危险字符检测 `validator.js`，全部对齐 data-model V-07/V-10）
- [x] T011 [P] 后端安全日志写入基础设施：`backend/src/common/logs/security-log.service.ts`（异步队列写 `SecurityLog`，eventType 枚举见 data-model §4，禁止落明文密码/验证码）
- [x] T012 后端 User 数据模型与表结构：`backend/src/modules/user/user.entity.ts`（字段/校验/状态机见 data-model §1）+ 迁移脚本（`users` 表：phone 哈希唯一索引、passwordHash、accountStatus、lockedUntil、passwordErrorCount）
- [x] T013 [P] 后端 RSA 密钥管理：`backend/src/modules/auth/rsa-manager.ts`（加载私钥、提供 `kid`、`/api/v1/auth/public-key` 接口返回 PEM 公钥）
- [x] T014 [P] 后端 Token 服务：`backend/src/modules/auth/token.service.ts`（JWT 签发 Access 2h + Refresh 7d，`jti` 绑定 userId/deviceSessionId，吊销黑名单写 Redis，校验逻辑对齐 data-model §3）
- [x] T015 前端 HTTP 客户端与 401 拦截器骨架：`frontend/src/shared/services/http.ts`（axios 实例、`Authorization: Bearer` 注入、401 时静默调 `/auth/refresh` 并重放原请求的拦截逻辑骨架）
- [x] T016 [P] 前端鉴权 Store：`frontend/src/features/auth/store/useAuthStore.ts`（Zustand：`user`、内存 `accessToken`、`login/setToken/clearAuth` 动作；Access Token 严禁写入任何持久化存储）
- [x] T017 [P] 前端路由与守卫骨架：`frontend/src/app/routes.tsx`（`/login` 公开 + `/dashboard` 受保护路由）+ `frontend/src/features/auth/guards/RequireAuth.tsx`（无 token → refresh → 失败清态跳 `/login`）

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 用户完成安全登录 (Priority: P1) 🎯 MVP

**Goal**: 用户通过「手机号 → 获取验证码 → 输入验证码+密码」完整闭环登录成功，进入受保护页面并保持登录状态。

**Independent Test**: 打开登录页输入合法手机号 `13800000001` → 点"获取验证码"出现 60s 倒计时 → 填验证码 `135792` + 密码 → 登录成功跳转 `/dashboard` 显示昵称头像；刷新页面仍保持登录态。对应 quickstart 场景 1。

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T018 [P] [US1] 后端发送验证码接口契约测试：`backend/tests/contract/send-sms.spec.ts`（手机号正则/冷却/限流错误码 10001/10002/10009）
- [x] T019 [P] [US1] 后端登录接口契约测试：`backend/tests/contract/login.spec.ts`（成功返回 accessToken+user、10003/10004/10006 错误矩阵）
- [x] T020 [P] [US1] 后端 Refresh 接口契约测试：`backend/tests/contract/refresh.spec.ts`（新 accessToken 下发、旧 refresh 吊销、10011/10012）
- [x] T021 [P] [US1] 前端登录流程集成测试：`frontend/tests/integration/LoginForm.test.tsx`（MSW mock 三个接口，验证成功跳转 + 本地无 accessToken + 60s 倒计时交互）
- [x] T022 [P] [US1] Playwright 正向登录 E2E：`frontend/tests/e2e/auth-login.spec.ts`（quickstart 场景 1 步骤 1~5，含刷新保持登录态）

### Implementation for User Story 1

- [x] T023 [P] [US1] 后端短信验证码服务：`backend/src/modules/auth/sms.service.ts`（生成 6 位验证码、写 Redis 5 分钟 TTL、60s 重发冷却 `setNX`、调用第三方短信通道，对齐 data-model §2）
- [x] T024 [P] [US1] 后端发送验证码接口：`backend/src/modules/auth/auth.controller.ts`（`POST /api/v1/auth/send-sms`，入参 Zod 校验 + 频控检查 + 写 SecurityLog，返回 `{sentAt,expiresAt,cooldownSeconds}`）
- [x] T025 [P] [US1] 后端登录接口：`backend/src/modules/auth/auth.controller.ts`（`POST /api/v1/auth/login`：验证码校验 → RSA 私钥解密密码 → bcrypt 比对 → 检查锁定 → 签发双 Token + `Set-Cookie` refresh_token）
- [x] T026 [P] [US1] 后端刷新接口：`backend/src/modules/auth/auth.controller.ts`（`POST /api/v1/auth/refresh`：校验 refresh_token → 吊销旧 jti → 签发新对）
- [x] T027 [P] [US1] 前端密码加密工具：`frontend/src/features/auth/services/rsaCrypto.ts`（WebCrypto 加载 PEM 公钥 + RSA-OAEP-2048 加密 → Base64）
- [x] T028 [P] [US1] 前端表单校验 Schema：`frontend/src/features/auth/schemas/loginSchema.ts`（引用 `packages/shared-schemas`，并导出错误码映射用于绑定提示文案）
- [x] T029 [P] [US1] 前端倒计时 Hook：`frontend/src/features/auth/hooks/useCountdown.ts`（60s 倒计时，结束时自动恢复按钮，`startedAt` 持久于 store 防刷新重置）
- [x] T030 [P] [US1] 前端验证码按钮组件：`frontend/src/features/auth/components/CountdownButton.tsx`（原生 `<button>`，`disabled` + `aria-disabled`，文案 `59s 后重新获取`）
- [x] T031 [P] [US1] 前端三个输入组件：`frontend/src/features/auth/components/PhoneInput.tsx`、`CodeInput.tsx`、`PasswordInput.tsx`（label + htmlFor + aria-describedby 错误绑定）
- [x] T032 [P] [US1] 前端登录表单组合组件：`frontend/src/features/auth/components/LoginForm.tsx`（组合以上输入 + `useLogin` 提交流：先 Zod 校验 → RSA 加密 → 调 `authApi.login` → 写 Store → 跳转）
- [x] T033 [P] [US1] 前端登录 API 封装：`frontend/src/features/auth/services/authApi.ts`（`sendSms/login/refresh/logout` 四个方法，对接 contracts §1~§4）
- [x] T034 [US1] 前端登录态接线与跳转：`frontend/src/app/App.tsx`（挂载 Router + 登录成功后 `/dashboard` 展示 `user.nickname` / 头像 / 脱敏手机号 `138****0001`）

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 非法输入被拦截并给出友好提示 (Priority: P2)

**Goal**: 手机号格式错误、验证码过期/错误、密码错误、空值等每一类非法输入在提交前即时拦截，并给出可理解、字段绑定的友好提示。

**Independent Test**: 依次输入非法手机号/过期验证码/错误验证码/错误密码/空值，验证是否被阻止提交并显示对应文案（对齐 spec P2 的 5 条场景 + quickstart 场景 2）。

### Tests for User Story 2

- [x] T035 [P] [US2] 前端 5 类非法输入集成测试：`frontend/tests/integration/LoginForm.invalid.test.tsx`（断言每类错误文案精确匹配、提交被阻止、Network 无请求）
- [x] T036 [P] [US2] 后端入参拦截契约测试：`backend/tests/contract/malicious-input.spec.ts`（XSS/SQLi 字符串 → 400 code 10010，核心函数未被调用）

### Implementation for User Story 2

- [x] T037 [P] [US2] 前端字段级错误提示绑定：`frontend/src/features/auth/components/LoginForm.tsx`（错误对象 `{field,message}` → 对应输入框 `aria-describedby` + 红边，展示 <200ms）
- [x] T038 [P] [US2] 后端网关入参拦截：`backend/src/common/filters/input-guard.ts`（危险字符检测 XSS/SQLi、缺字段/类型错误 → 400 code 10010 + 写 `MALICIOUS_INPUT_DETECTED` 日志，不进入业务逻辑）
- [x] T039 [US2] 后端错误码与文案映射表：`backend/src/modules/auth/error-codes.ts`（集中管理 10001~10012 文案，对齐 contracts §0；"未注册手机号登录"与"密码错误"同文案 10006 防枚举）
- [x] T040 [P] [US2] 前端提交禁用/加载联动：`frontend/src/features/auth/hooks/useLogin.ts`（Zod 未通过或提交中 → 登录按钮 disabled；错误响应解析 `errors[]` 回填字段）
- [x] T041 [US2] 验证码错误次数提示升级：`backend/src/modules/auth/security.service.ts`（验证码 1~4 次错 10004，第 5 次 10005 并锁 phone 10min；密码 10 次错 10007 锁账号 30min，对齐 data-model V-05/V-06）

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 失效凭证与非法访问被拦截 (Priority: P3)

**Goal**: 令牌过期/被篡改时自动清态跳登录；批量/高频/恶意请求在入口被拦截；登出吊销令牌。

**Independent Test**: 登录后手动篡改或删除令牌 → 访问 `/dashboard` 被踢回登录页并提示"登录状态已过期"；1 分钟内发 21 次登录请求 → 第 21 次返回 429 code 10009；恶意参数请求 → 400 code 10010。

### Tests for User Story 3

- [x] T042 [P] [US3] 令牌失效 E2E：`frontend/tests/e2e/auth-token-expiry.spec.ts`（篡改/过期 → 401 → refresh 失败 → 清态跳登录 + toast，对应 quickstart 场景 3）
- [x] T043 [P] [US3] 限流与恶意入参契约测试：`backend/tests/contract/rate-limit.spec.ts`（1min 21 次 → 第 21 次 10009；XSS/SQLi 入参 → 10010）

### Implementation for User Story 3

- [x] T044 [P] [US3] 前端 401 静默刷新完善：`frontend/src/shared/services/http.ts`（单飞并发刷新、刷新失败清态 + 跳 `/login?expired=1`）
- [x] T045 [P] [US3] 后端令牌校验中间件：`backend/src/common/middleware/require-auth.ts`（过期 → 10011、签名篡改/吊销 → 10012，对齐 data-model §3 状态机）
- [x] T046 [P] [US3] 后端滑动窗口限流实现：`backend/src/modules/auth/security.service.ts`（Redis ZSET 滑动窗口：IP 1min>20、phone 1hr>10 → 429 code 10009 + `RATE_LIMIT_HIT` 日志）
- [x] T047 [P] [US3] 后端登出接口：`backend/src/modules/auth/auth.controller.ts`（`POST /api/v1/auth/logout`，吊销当前/全部设备 jti + `Set-Cookie Max-Age=0` 清除 refresh_token）
- [x] T048 [US3] 前端登出与守卫联动：`frontend/src/features/auth/store/useAuthStore.ts` + `guards/RequireAuth.tsx`（登出清 Store + 跳 `/login`；改密/风控导致的 10012 也统一清态）

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 影响多个用户故事的收尾与横切改进

- [x] T049 [P] WCAG 2.1 AA 断言：`frontend/tests/e2e/a11y.spec.ts`（@axe-core/playwright 扫 `/login` 与 `/dashboard`，0 serious 违规，含键盘 Tab 流转）
- [x] T050 [P] Storybook 组件快照与 axe：`.storybook/stories/auth/*.stories.tsx`（5 个组件全量渲染 + axe-core 断言 + 无视觉抖动快照）
- [x] T051 [P] 性能优化：`frontend/vite.config.ts`（登录页路由懒加载 + 首屏 chunk 分析，LCP < 1.5s；验证码倒计时不触发整页重渲染）
- [x] T052 [P] 安全加固：后端响应头（`X-Frame-Options: DENY`、CSP frame-ancestors）、CORS 白名单、`helmet` 中间件，对齐 quickstart §4.2
- [x] T053 覆盖率收口：`frontend/tests/unit/` + `backend/tests/unit/`（`loginSchema`、`rsaCrypto`、`security.service`、`token.service` 单测，业务逻辑 ≥80%、渲染 ≥60%、SecurityService/Zod Schema 100%）
- [x] T054 全量验证：按 [quickstart.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/quickstart.md) §3 执行 `npm run test:unit/integration/e2e/storybook:test` + typecheck + lint + build，全部通过
- [x] T055 上线收尾：`.env.example` 生产参数注释、README 补充本 feature 运行说明、核对 quickstart §5 上线 Checklist 8 项（RSA 密钥/RMS/短信/测试/压测/渗透/宪法/文案）全部 ✅

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5) 建议按优先级顺序推进；若团队并行，US2/US3 可在 Phase 2 完成后与 US1 并行开发
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: 依赖 Phase 2 的 T012(User 模型)/T013(RSA)/T014(Token)/T015(http)/T016(store)/T017(路由守卫)
- **User Story 2 (P2)**: 依赖 Phase 2 的 T008(shared-schemas)/T009(错误信封)/T010(security.service)，可复用 US1 的 LoginForm 组件
- **User Story 3 (P3)**: 依赖 Phase 2 的 T010(security.service)/T014(token.service)/T015(http 拦截器)，复用 US1 的登录态

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- 前端：Schema → 加密/倒计时工具 → 组件 → 表单组合 → Store/路由接线
- 后端：Service（短信/安全）→ Controller（接口）→ 中间件/日志挂载
- 每个 Story 完成后独立验证，再进入下一优先级

### Parallel Opportunities

- Phase 1：T002/T003/T004/T005/T007 可并行；T006(Redis) 与 T001 可并行
- Phase 2：T010/T011、T013/T014、T016/T017 可并行（不同文件无依赖）
- Phase 3 内：T023~T026 后端、T027~T033 前端均为独立文件可并行；T018~T022 测试先行可并行
- Phase 4/5 同理：前后端任务文件互不冲突可并行
- 三个 User Story 在 Phase 2 完成后可由不同开发者并行（US1 建议先完成以形成 MVP）

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (write first, ensure they FAIL):
Task: "T018 后端发送验证码接口契约测试 backend/tests/contract/send-sms.spec.ts"
Task: "T019 后端登录接口契约测试 backend/tests/contract/login.spec.ts"
Task: "T021 前端登录流程集成测试 frontend/tests/integration/LoginForm.test.tsx"
Task: "T022 Playwright 正向登录 E2E frontend/tests/e2e/auth-login.spec.ts"

# Launch all backend models/services together:
Task: "T023 后端短信验证码服务 backend/src/modules/auth/sms.service.ts"
Task: "T025 后端登录接口 backend/src/modules/auth/auth.controller.ts"
Task: "T027 前端密码加密工具 frontend/src/features/auth/services/rsaCrypto.ts"
Task: "T029 前端倒计时 Hook frontend/src/features/auth/hooks/useCountdown.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup（T001~T007）
2. Complete Phase 2: Foundational（T008~T017，CRITICAL - blocks all stories）
3. Complete Phase 3: User Story 1（T018~T034）
4. **STOP and VALIDATE**: 按 quickstart 场景 1 独立测试 US1（17 项 E2E 中 P1 相关通过）
5. Deploy/demo if ready —— 此时用户已可完成安全登录闭环

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2（非法输入拦截与友好提示）→ Test → Deploy/Demo
4. Add User Story 3（失效凭证/限流/恶意拦截防御）→ Test → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1（登录主流程）
   - Developer B: User Story 2（输入校验 + 错误提示）
   - Developer C: User Story 3（令牌/限流/安全拦截）
3. Stories complete and integrate independently；最后由 T049~T055 收口

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- 每个测试任务须先写并确认 FAIL，再实现对应功能
- 提交建议：每个逻辑组完成后 `git commit`（如 `feat(auth): send-sms endpoint + cooldown`）
- 任一 Phase Checkpoint 可停下独立验证该 Story
- 严格遵循 `- [ ] T### [P] [US#] 描述 + 路径` 格式；禁止无 ID/无 Story/无路径的模糊任务

---

## Phase 7: Convergence

**Purpose**: `/speckit-converge` 收敛评估（2026-09-02）——代码库相对 spec/plan/tasks 的剩余差距

- [x] T056 将 CI 流水线对齐 npm workspaces：`.github/workflows/ci.yml` 从 `pnpm/action-setup` + `pnpm install --frozen-lockfile` + `pnpm typecheck/lint/test/build/test:e2e/storybook:test` 改为 `actions/setup-node` + `npm ci` + `npm run typecheck/lint/test/build/test:e2e/storybook:test`（并同步删除或重建与 npm workspaces 一致的 `pnpm-lock.yaml`，避免 frozen-lockfile 校验失败）per T007 / plan: Monorepo 决策（contradicts）
- [x] T057 补齐 Storybook a11y addon：在 `frontend/package.json` devDependencies 安装 `@storybook/addon-a11y`（`main.ts` 已声明该 addon，但依赖缺失导致 Storybook 启动/axe 断言失败）；若确认不需要该 addon 则从 `frontend/.storybook/main.ts` addons 数组移除并说明理由 per T050 / plan: Storybook + axe（partial）
