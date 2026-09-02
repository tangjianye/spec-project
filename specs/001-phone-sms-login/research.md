# Research & Technical Decisions: 手机号验证码登录

**Created**: 2026-09-01
**Feature**: [spec.md](file:///Users/tangjianye/Desktop/github/spec-project/specs/001-phone-sms-login/spec.md)

---

## 01. 前端框架与构建工具

**Decision**: React 18 + TypeScript (strict) + Vite 5.x

**Rationale**:
- 完全符合《项目宪法》"Technology Stack & Standards"章节的强制选型；不引入额外学习成本。
- Vite 构建产物支持 Tree-shaking 和按路由代码分割，可直接满足宪法 III. Performance-First 中 CLS ≤ 0.1 的指标要求。
- React 18 的 Suspense + useTransition 能够帮助验证码倒计时、登录提交 Loading 等交互在网络波动时避免 UI 抖动。

**Alternatives considered**:
- **Next.js App Router**: 引入 SSR/ISR 能力，但本功能是纯客户端表单 + 调用后端登录接口，服务端渲染不提供额外价值，反而增加部署与 cookie 跨域复杂度，否决。
- **Vue 3 + Pinia**: 团队统一使用 React，技术栈分裂将带来长期维护成本，否决。

---

## 02. 密码前端加密方案

**Decision**: RSA-2048 非对称加密（前端用公钥加密密码明文 → 后端用私钥解密 → 再使用 bcrypt 哈希入库）

**Rationale**:
- 直接响应 spec FR-004 "前端加密处理 + 非明文传输存储"的要求。
- 即使 HTTPS 被降级或内网代理抓包，密码字段本身仍以公钥加密形态传输，满足 SC-004 安全渗透测试中"中间人"类攻击拦截要求。
- RSA 在浏览器环境可通过 Web Crypto API 或 SubtleCrypto 原生实现，零额外依赖，不增加 bundle 体积（符合 Performance-First）。
- 公钥可在页面首次加载时拉取或内联，过期轮换通过接口返回新公钥 `kid` 字段无感切换。

**Alternatives considered**:
- **直接发送明文 + HTTPS**: 不满足 FR-004，且在混合部署场景、第三方 WebView 场景下 HTTPS 保障不完整，否决。
- **前端 bcrypt 哈希后传输**: 等价于把密码哈希变成了"新密码"，彩虹表攻击时仍可直接用哈希值重放，无法做到前后端双重加密的效果，否决。
- **AES 对称加密**: 密钥下发与轮换复杂度高，一旦前端密钥被抓包就等于完全失效，非对称更安全，否决。

---

## 03. 登录令牌选型与存储方式

**Decision**: JWT (Access Token, 2h 有效) + 透明 HttpOnly Secure Cookie (Refresh Token, 7 天有效 + 可吊销)，Access Token 存放内存变量

**Rationale**:
- 对齐宪法 FR-010"通过 HttpOnly Cookie 或同等安全等级存储，避免第三方脚本读取"。
- 双 Token 方案：Access Token 短时效降低泄漏风险，Refresh Token 放在 HttpOnly 抵御 XSS；每次 Access Token 过期前端静默刷新，满足 SC-006"7 天内重开应用无需重新登录"。
- 内存变量存放 Access Token 可彻底防御通过 `localStorage` 读取的 XSS 攻击；刷新页面时通过 `/auth/refresh` 自动续期，不影响体验。
- 登录令牌支持主动吊销（登出/改密），符合 P3 US3 多端登录独立失效的需求。

**Alternatives considered**:
- **纯 JWT + localStorage**: 极易被 XSS 窃取，违反 FR-010，否决。
- **纯 Session Cookie (Server-side Session)**: 需要后端 Redis 集中管理会话，部署复杂度高；且多端登录与踢下线策略需要额外状态同步，JWT + 短列表吊销更简单，否决。
- **单 JWT 有效期 7 天**: 泄漏后 7 天内都无法快速失效，安全风险高，否决。

---

## 04. 短信验证码存储与频控

**Decision**: 验证码存入 Redis，key 为 `sms:{phone}:{scenario=login}`，5 分钟 TTL；频控两层：
- 同一手机号 60s 内发送限流：Redis `SETNX` + 60s TTL
- 同 IP 每分钟 20 次 / 同手机号每小时 10 次：滑动窗口 ZSET 计数

**Rationale**:
- 精确落实 FR-002（60s 倒计时）、FR-003（5 分钟过期）、FR-008（接口限流）的要求。
- 单 Redis 即可统一处理验证码校验 + 频控 + 错误次数累计，无需引入数据库事务，响应性能可确保 P95 < 300ms 的 SC-005。
- 滑动窗口可防"边界时刻绕过限流"的常见攻击（如 1 分 59 秒 + 2 分 00 秒各打 20 次），进一步加固 SC-004 安全渗透通过率。

**Alternatives considered**:
- **验证码存入 DB (MySQL/PG)**: 查询与 TTL 清理性能差，高频登录场景下拖垮核心业务库，否决。
- **纯内存限流 (Node/进程内)**: 多实例部署下流控计数不同步，N 倍放大限流阈值，不安全，否决。
- **固定窗口限流**: 窗口边界漏洞显著，无法通过 SC-004 渗透测试，否决。

---

## 05. 前端状态管理与路由守卫

**Decision**: Zustand 作为全局 store（管理当前用户信息、Access Token 内存引用）+ React Router v6 嵌套路由 + 自定义 `<RequireAuth>` 守卫组件

**Rationale**:
- 完全匹配宪法 Technology Stack 章节 "Zustand for complex global stores + useState/useReducer for local"。
- Zustand 极简 API，引入体积 < 2KB，不影响 Performance-First 包体指标。
- `<RequireAuth>` 守卫组件统一拦截鉴权失效：检测到 401 或 Access Token 为空时调 `refresh` 接口，再失败则清除登录态并跳转登录页（落实 P3 US1 令牌过期自动退出）。
- 本地表单状态（手机号、验证码、密码、倒计时、校验错误）直接用 `useState`，避免过度使用全局状态。

**Alternatives considered**:
- **Redux Toolkit + RTK Query**: 功能足够，但对于登录这种单 feature 的复杂度属于过度设计，样板代码多 + 包体较大，违反 Simplicity 原则，否决。
- **Context API + useReducer**: 多层 Provider 嵌套会带来不必要的重渲染，动态表单会产生性能抖动（违反性能优先中的"避免视觉抖动"要求），否决。

---

## 06. 安全防御层（入参清洗 / WAF 级拦截 / 错误次数锁定）

**Decision**: 三层防御：
- 层 1（前端）：zod Schema 实时校验手机号正则、验证码 6 位数字、密码长度 ≥ 8，错误即时提示（落实 P2 输入校验，满足 SC-003 <200ms 延迟）
- 层 2（接口网关 / 后端入参拦截）：Zod 同样 Schema 二次校验 + `validator` 库检测 SQL 注入、XSS 关键字；命中直接返回 400 并写入 SecurityLog（落实 FR-007）
- 层 3（安全策略引擎）：独立 `SecurityService` 聚合 Redis 中的"验证码错误计数""密码错误计数""IP/手机号限流计数"，触发 FR-003（5 次/10 分钟）、FR-009（10 次/30 分钟锁定）阈值即阻断

**Rationale**:
- 分层防御恰好对应 FR-007 "入口层即拦截、不进入核心业务逻辑"。
- 前后端共用 Zod Schema：避免前端通过校验、后端却不通过的不一致提示（减少用户困惑，有利于 SC-002 95% 首次成功率）。
- SecurityLog 写入可异步（队列/ fire-and-forget），不影响主流程 P95 响应时间。

**Alternatives considered**:
- **仅前端校验**: 可被 Postman/curl 绕过，违反 FR-007 与 SC-004，否决。
- **仅后端校验**: 错误提示慢（需网络往返），不满足 SC-003 < 200ms，否决。
- **正则手写清洗**: 易遗漏 XSS/SQLi 变种，社区成熟库 `validator.js` 覆盖更全，否决自实现。

---

## 07. 测试策略与工具链

**Decision**:
- **单测**: Vitest + @testing-library/react（用户视角测组件行为，不测实现细节）；覆盖 Zod 校验、倒计时 hook、密码加密 util、SecurityService 计数逻辑
- **集成**: Vitest + MSW（Mock Service Worker）模拟后端登录/验证码/刷新 Token 接口，测完整表单流程与错误分支
- **E2E**: Playwright 模拟真实浏览器，覆盖 P1~P3 全部 12 条 Acceptance Scenarios + Edge Cases；还负责测"令牌过期自动跳登录页"
- **覆盖率门槛**: 直接沿用宪法标准（业务逻辑 80% / 渲染 60%），SecurityService、Zod Schema 必须 100%

**Rationale**:
- 完全对齐宪法 Testing Standards 章节选型，无需引入新工具。
- RTL + 角色查询的测试模式天然可验证 WCAG 2.1 AA 无障碍（Accessible Name / 键盘可达），间接辅助宪法 IV. Accessibility Compliance 的合规。
- MSW 让集成测试可在无后端情况下完成，并行执行速度快，避免 CI 等待时间长。
- Playwright 可并行多浏览器（Chromium / WebKit / Firefox），自动做视觉对比防抖动，契合宪法 III 中"避免视觉抖动"。

**Alternatives considered**:
- **Jest + Enzyme**: Enzyme 不支持 React 18 新特性，Jest ESM 配置麻烦，Vite 生态直接用 Vitest 更优，否决。
- **Cypress**: 跨域 iframe、多标签、网络层 mock 能力弱于 Playwright，且 Constitution 已指定 Playwright，否决。

---

## 08. 无障碍（A11y）与可访问性落地

**Decision**:
- 所有输入框配合显式 `<label>` + `htmlFor`，字段错误通过 `aria-describedby` 绑定，屏幕阅读器即时朗读（落实宪法 IV Accessibility Compliance）
- 登录按钮、获取验证码按钮用原生 `<button>`，禁用态通过 `disabled` 属性 + `aria-disabled` 双重标记
- 颜色对比度 ≥ 4.5:1（文本）/ 3:1（大文本/控件边框），通过 Storybook + axe-core 在 CI 断言
- 整个表单支持 Tab 顺序焦点流转：手机号 → 获取验证码 → 验证码 → 密码 → 登录按钮；Enter 键在密码框触发提交

**Rationale**:
- 严格落实《项目宪法》IV. Accessibility Compliance "WCAG 2.1 AA" 强制要求。
- axe-core 接入 Storybook 的自动化检测可确保"a11y 违规按编译错误处理"（宪法 IV 最后一条）。
- 键盘 Tab + Enter 流本身也是提升普通用户效率的体验点，与 SC-001 "20s 内完成登录"相辅相成。

**Alternatives considered**:
- **仅做手动视觉自查**: 无法量化、易遗漏，违反宪法"Automated a11y linting runs at build time"，否决。
- **颜色对比度只测主色板**: 错误态红色、禁用态灰色常被漏掉，必须在组件级全量过 axe-core，否决。

---

## Research Sign-off

所有 8 项技术决策均已完成并记录，无剩余 `NEEDS CLARIFICATION`。每项决策均可回溯到对应宪法条款或 spec FR/SC 条目，一致性检查通过 → 可进入 Phase 1 设计（data-model + contracts + quickstart）。
