# Spec Project — 手机号验证码登录（001-phone-sms-login）

遵循 [Spec Kit](.specify/) 规范驱动开发流程构建的"手机号 + 短信验证码 + 密码加密"安全登录功能。

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
- **Monorepo**：pnpm workspace（`frontend` / `backend` / `packages/shared-schemas`）

## 快速开始

```bash
# 安装依赖（需要 Node 20 + pnpm 9）
npx -y pnpm@9 install

# 启动后端（默认 USE_IN_MEMORY_STORE=true，无 Redis 也能跑）
cd backend && npm run dev

# 启动前端（另开终端）
cd frontend && npm run dev
```

浏览器访问 `http://localhost:5173/login`，测试账号（测试通道固定验证码 `123456`）：

| 手机号 | 密码 | 用途 |
|--------|------|------|
| 13800000001 | Password123! | 正常登录 |
| 13800000002 | Password123! | 密码错误计数已 9 次（1 次错误即锁定） |
| 13800000003 | Password123! | 已锁定（20 分钟后解锁） |
| 13800000099 | — | 未注册（防枚举验证） |

## 质量门禁（宪法合规）

```bash
pnpm typecheck   # TS strict，0 any
pnpm lint        # ESLint + Prettier，0 warnings
pnpm test        # Vitest 单测 + 集成（USE_IN_MEMORY_STORE=true）
pnpm build       # Vite/TS 构建
pnpm test:e2e    # Playwright E2E + WCAG axe 断言（需先启前后端或由 webServer 拉起）
```

## 目录结构

```text
specs/001-phone-sms-login/   # 规范-计划-任务-验收文档
frontend/src/features/auth/  # 登录组件/Hook/Schema/Store/守卫
backend/src/modules/auth/    # 验证码/登录/刷新/登出 + 安全策略
packages/shared-schemas/     # 前后端共用 Zod 校验规则
```
