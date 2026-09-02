# Implementation Plan: 用户资料编辑

**Branch**: `002-edit-user-profile` | **Date**: 2026-09-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-edit-user-profile/spec.md`

## Summary

在现有 React + Express TypeScript monorepo 中增加受鉴权保护的用户资料读取、编辑和头像上传能力。前后端共用 Zod 资料 schema；后端扩展 UserRepository，并以 `version` 实现乐观并发控制；前端新增懒加载资料页、可复用表单字段、头像预览和离开保护，同时在保存成功后同步 Zustand 中的登录用户摘要。

技术决策及替代方案见 [research.md](research.md)，接口行为见 [contracts/profile-endpoints.md](contracts/profile-endpoints.md)。

## Technical Context

**Language/Version**: TypeScript 5.5 strict；Node.js 20+

**Primary Dependencies**: React 18.3、React Router 6.24、Zustand 4.5、Axios 1.7、Zod 3.23、Express 4.19、现有 JWT 鉴权中间件；头像处理优先使用浏览器原生 File/URL API 和服务端文件校验，不新增表单库或状态库

**Storage**: 当前开发/测试沿用 `UserRepository` 内存存储；资料字段和 `version` 设计为可直接映射到后续关系型数据库。头像开发环境存受控本地目录，生产环境通过同一存储接口接对象存储/CDN

**Testing**: Vitest（shared schema、repository、service、React 单元/集成）、React Testing Library + MSW（表单流程）、Supertest（API 契约）、Playwright + axe-core（端到端与 WCAG 2.1 AA）

**Target Platform**: Node.js Linux 服务端；现代桌面及移动浏览器，响应式 React SPA

**Project Type**: 前后端分离 Web application monorepo

**Performance Goals**: 95% 的资料读取/保存操作在 2 秒内反馈；客户端字段错误在单次交互内可见；头像预览不阻塞其他字段编辑；满足 LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1

**Constraints**: 仅编辑本人资料；5 MB 请求上限；头像只接受 JPEG/PNG/WebP 且必须验证真实文件类型；资料更新原子化；并发冲突不得静默覆盖；Access Token 继续仅存内存；所有交互符合 WCAG 2.1 AA；TS strict 且禁止无说明的 `any`

**Scale/Scope**: 单个资料编辑页面、3 个后端接口、1 套共享 schema；沿用现有项目日活 10 万级假设，资料保存不是高频路径

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| 宪法条款 | 计划落实 | 初始 | Phase 1 复核 |
|---------|----------|------|--------------|
| I. Spec-Driven Development | spec → research → plan/model/contracts/quickstart；设计映射 FR-001~FR-016 | PASS | PASS |
| II. Component-First Architecture | `ProfileForm` 组合 `AvatarField`、`TextField`、`GenderField`、`BirthdayField`；请求与脏状态逻辑进入 hook/service | PASS | PASS |
| III. Performance-First | 页面路由懒加载；头像客户端预览；固定预览尺寸避免布局偏移；性能指标纳入 quickstart | PASS | PASS |
| IV. Accessibility Compliance | 原生 label/fieldset、错误关联、焦点管理、键盘离开确认与 axe/Playwright 验收 | PASS | PASS |
| V. Type Safety & Code Quality | 前后端共用 Zod 推导类型；TS strict；Vitest、lint、format、build 门禁 | PASS | PASS |
| Technology Stack | 沿用 React 18、Vite、Zustand、Express、Vitest、Playwright，无栈偏离 | PASS | PASS |
| Quality Gates | quickstart 覆盖 typecheck/lint/test/build/a11y；任务阶段需将全部门禁落实 | PASS | PASS |

无宪法违规；Phase 0 和 Phase 1 均允许继续。

## Project Structure

### Documentation (this feature)

```text
specs/002-edit-user-profile/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── profile-endpoints.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # 由 $speckit-tasks 生成
```

### Source Code (repository root)

```text
packages/shared-schemas/
├── src/index.ts                         # 新增 profile schemas、类型与错误码
└── tests/profile-schema.test.ts

backend/
├── src/
│   ├── app.ts                           # 挂载 /api/v1/profile
│   └── modules/user/
│       ├── user.entity.ts               # 扩展资料字段、version 与原子更新
│       ├── profile.controller.ts        # GET/PATCH profile、POST avatar
│       ├── profile.service.ts            # 权限、校验、冲突与头像编排
│       ├── profile.instance.ts
│       └── avatar-storage.ts             # 可替换的头像存储边界
└── tests/
    ├── contract/profile.spec.ts
    └── unit/profile.service.test.ts

frontend/
├── src/
│   ├── app/routes.tsx                   # 新增懒加载 /profile/edit
│   ├── features/profile/
│   │   ├── components/
│   │   │   ├── AvatarField.tsx
│   │   │   ├── BirthdayField.tsx
│   │   │   ├── GenderField.tsx
│   │   │   ├── ProfileForm.tsx
│   │   │   └── TextField.tsx
│   │   ├── hooks/useProfileForm.ts
│   │   ├── services/profileApi.ts
│   │   └── schemas/profileSchema.ts     # shared schema 的 UI 适配/错误文案
│   ├── features/auth/store/useAuthStore.ts # 新增 user 摘要更新动作
│   └── pages/EditProfilePage.tsx
└── tests/
    ├── integration/ProfileForm.test.tsx
    ├── unit/profileSchema.test.ts
    └── e2e/profile-edit.spec.ts
```

**Structure Decision**: 延续现有 web application monorepo。领域代码分别落入 `frontend/src/features/profile` 和 `backend/src/modules/user`，跨端契约继续归 `packages/shared-schemas`；不创建新的应用、全局状态容器或重复 HTTP 基础设施。

## Complexity Tracking

无宪法违规或需要例外说明的新增复杂度。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
