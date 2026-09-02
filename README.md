# Spec Project — 登录与用户资料编辑

遵循 [Spec Kit](.specify/) 规范驱动开发流程构建的"手机号 + 短信验证码 + 密码加密"安全登录功能。

## 用户资料编辑（002-edit-user-profile）

- 受鉴权保护的 `/profile/edit` 页面，可编辑昵称、个人简介、性别和生日
- JPEG/PNG/WebP 头像预览与上传，最大 5 MB，服务端验证并统一转为 WebP
- 版本号乐观并发控制，旧页面提交返回 409，不静默覆盖
- 保存失败保留草稿，应用内导航和刷新提供未保存提醒
- 规格、计划、契约与任务见 [specs/002-edit-user-profile](specs/002-edit-user-profile/)

## 功能范围（见 [spec.md](specs/001-phone-sms-login/spec.md)）

- 手机号（11 位中国大陆号段）格式校验
- 短信验证码：60s 发送冷却、5 分钟有效期、弱码拒绝、错误 5 次锁定 10 分钟
- 密码：前端 RSA-2048 公钥加密 → 后端私钥解密 → bcrypt 比对；错误 10 次锁定 30 分钟
- 双 Token：Access（2h，内存）+ Refresh（7d，HttpOnly Cookie）静默续期
- 三层安全：前端 Zod 实时校验 / 后端入参拦截（SQLi/XSS）/ 频控（IP 20/min、手机号 10/hr）
- 未注册手机号与密码错误同文案防枚举；全量 SecurityLog 审计

## 技术栈

- **前端**：React 18 + TypeScript(strict) + Vite + Zustand + React Router v6 + Zod
- **后端**：Node.js 20 + Express + Redis(ioredis) + JWT + bcryptjs + validator
- **测试**：Vitest + RTL + MSW（单测/集成）、Playwright + axe-core（E2E/A11y）
- **Monorepo**：npm workspaces（`frontend` / `backend` / `packages/shared-schemas`，pnpm 兼容）

## 快速开始

> 要求 Node.js ≥ 20。后端默认使用内存存储（`USE_IN_MEMORY_STORE=true`），无 Redis 也能直接运行。

### 方式一：根目录一键启动（推荐）

```bash
# 1) 安装依赖
npm install

# 2) 同时启动后端(3001) + 前端(5173)
npm run dev
```

### 方式二：分终端启动

```bash
# 终端 1：后端
cd backend && npm run dev

# 终端 2：前端
cd frontend && npm run dev
```

浏览器访问 `http://localhost:5173/login`，测试账号（测试通道固定验证码 `135792`）：

登录后可从 Dashboard 点击“编辑资料”，或直接访问 `http://localhost:5173/profile/edit`。

| 手机号 | 密码 | 用途 |
|--------|------|------|
| 13800000001 | Password123! | 正常登录 |
| 13800000002 | Password123! | 密码错误计数已 9 次（1 次错误即锁定） |
| 13800000003 | Password123! | 已锁定（20 分钟后解锁） |
| 13800000004 | Password123! | 用户资料编辑 E2E 隔离账号 |
| 13800000005 | Password123! | 用户资料性能 E2E 隔离账号 |
| 13800000006 | Password123! | 用户资料并发冲突 E2E 隔离账号 |
| 13800000099 | — | 未注册（防枚举验证） |

> 说明：`135792` 是弱码防御规则（拒绝 6 个相同数字与 123456/654321 等连续序列）下的合法测试验证码；
> 本地/测试环境（`NODE_ENV !== 'production'`）且手机号在白名单（见 `.env.example` 的 `SMS_TEST_WHITELIST`，默认含上述测试号）时统一使用固定码；生产环境仍为随机 6 位数字。

## 质量门禁（宪法合规）

```bash
npm run typecheck   # TS strict，0 any
npm run lint        # ESLint + Prettier，0 warnings
npm test            # Vitest 单测 + 集成（USE_IN_MEMORY_STORE=true）
npm run build       # Vite/TS 构建
npm run test:e2e    # Playwright E2E + WCAG axe 断言（webServer 自动拉起前后端）
```

## 目录结构

```text
specs/001-phone-sms-login/   # 规范-计划-任务-验收文档
frontend/src/features/auth/  # 登录组件/Hook/Schema/Store/守卫
frontend/src/features/profile/ # 资料表单、头像、草稿与冲突处理
backend/src/modules/auth/    # 验证码/登录/刷新/登出 + 安全策略
backend/src/modules/user/    # 用户资料、版本更新和头像存储
packages/shared-schemas/     # 前后端共用 Zod 校验规则
```
