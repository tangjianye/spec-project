# Tasks: 用户资料编辑

**Input**: Design documents from `specs/002-edit-user-profile/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/profile-endpoints.md, quickstart.md

**Tests**: 本项目宪章要求单元、集成、E2E 与可访问性测试；每个故事的测试任务先于实现执行并应先观察到失败。

**Organization**: 任务按用户故事分组，使 P1 可作为 MVP 独立交付，P2/P3 在其后形成可分别验证的增量。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可与同阶段其他标记任务并行，因修改不同文件且无未完成依赖
- **[Story]**: 对应 spec.md 中的 US1、US2、US3
- 每项任务均给出准确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 准备资料模块所需依赖、测试入口和目录边界

- [X] T001 Add multer, sharp, and multer type dependencies for bounded multipart avatar processing in backend/package.json
- [X] T002 [P] Add profile contract test script coverage to existing Vitest commands in backend/package.json
- [X] T003 [P] Create profile feature test mock entry point alongside existing auth handlers in frontend/tests/integration/mocks/profile-handlers.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有用户故事共用的资料类型、错误语义、持久化字段和状态同步能力

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事实现

- [X] T004 Add ProfileErrorCode constants plus nickname, bio, gender, birthDate, profile response, and profile update Zod schemas with inferred types in packages/shared-schemas/src/index.ts
- [X] T005 [P] Add boundary tests for trimming, Unicode, emoji, 30/200-character limits, nullable fields, future dates, and expectedVersion in packages/shared-schemas/tests/profile-schema.test.ts
- [X] T006 Extend ApiError and errorFilter to support optional structured error data for 409 currentProfile responses without changing existing auth envelopes in backend/src/common/filters/response-filter.ts
- [X] T007 Extend UserRecord seed data with bio, gender, birthDate, avatarImageId, profileVersion, and profileUpdatedAt defaults in backend/src/modules/user/user.entity.ts
- [X] T008 Add atomic find/update-by-userId repository operations with expected-version checks and immutable account fields in backend/src/modules/user/user.entity.ts
- [X] T009 [P] Add updateUserSummary action that changes only nickname and avatarUrl while preserving token/session state in frontend/src/features/auth/store/useAuthStore.ts

**Checkpoint**: 跨端资料契约、版本化资料存储和登录摘要同步能力就绪

---

## Phase 3: User Story 1 - 编辑并保存个人资料 (Priority: P1) 🎯 MVP

**Goal**: 已登录用户可以读取、校验、原子保存基础资料，并在刷新或返回页面后看到最新内容

**Independent Test**: 登录测试账号，进入 `/profile/edit` 修改昵称、简介、性别和生日并保存；返回 Dashboard 后重新进入，确认资料及用户摘要与最后一次成功保存一致

### Tests for User Story 1 ⚠️

- [X] T010 [P] [US1] Write GET/PATCH profile contract tests for authentication, ownership, valid update, field errors, future birthDate, atomic rollback, and version increment in backend/tests/contract/profile.spec.ts
- [X] T011 [P] [US1] Write repository unit tests for Unicode fields, nullable clearing, immutable account fields, and atomic versioned updates in backend/tests/unit/user-profile.repository.test.ts
- [X] T012 [P] [US1] Write frontend schema tests for Chinese error messages and shared-schema field mapping in frontend/tests/unit/profileSchema.test.ts
- [X] T013 [P] [US1] Write ProfileForm integration tests for initial loading, valid save, no-op state, field errors, failed-save draft retention, and auth summary refresh in frontend/tests/integration/ProfileForm.test.tsx

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement frontend validation adapters and field error message mapping over shared profile schemas in frontend/src/features/profile/schemas/profileSchema.ts
- [X] T015 [P] [US1] Implement authenticated GET/PATCH profile client and typed envelope parsing in frontend/src/features/profile/services/profileApi.ts
- [X] T016 [P] [US1] Implement accessible reusable text input and textarea with label, counter, error association, and focus contract in frontend/src/features/profile/components/TextField.tsx
- [X] T017 [P] [US1] Implement accessible gender fieldset with supported options and clear action in frontend/src/features/profile/components/GenderField.tsx
- [X] T018 [P] [US1] Implement birthday input with clear action, max-today constraint, and field error association in frontend/src/features/profile/components/BirthdayField.tsx
- [X] T019 [US1] Implement profile service for current-user reads, shared-schema validation, immutable-field protection, atomic repository update, and full profile response in backend/src/modules/user/profile.service.ts
- [X] T020 [US1] Implement authenticated GET/PATCH endpoints and map validation/auth failures to the profile contract in backend/src/modules/user/profile.controller.ts
- [X] T021 [US1] Instantiate profile service dependencies and mount input guard plus profile router at /api/v1/profile in backend/src/modules/user/profile.instance.ts and backend/src/app.ts
- [X] T022 [US1] Implement profile loading, baseline/draft comparison, field validation, save state, and successful baseline/Auth Store synchronization in frontend/src/features/profile/hooks/useProfileForm.ts
- [X] T023 [US1] Compose loading, error, form, save, reset, and status-live-region behavior in frontend/src/features/profile/components/ProfileForm.tsx
- [X] T024 [US1] Create the protected profile edit page and lazy /profile/edit route with Dashboard navigation entry in frontend/src/pages/EditProfilePage.tsx, frontend/src/app/routes.tsx, and frontend/src/pages/DashboardPage.tsx

**Checkpoint**: P1 基础资料读取/保存闭环可独立运行并通过契约、单元和集成测试

---

## Phase 4: User Story 2 - 更换个人头像 (Priority: P2)

**Goal**: 用户可预览合规头像、拒绝不合规文件，并在资料保存后让新头像一致生效

**Independent Test**: 选择合规图片预览并保存，刷新 Dashboard 和编辑页确认头像一致；分别验证超限、伪装、损坏及不支持文件均被拒绝且原头像不变

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Extend avatar upload contract tests for JPEG/PNG/WebP, 5 MB boundary, signature mismatch, corrupt data, cross-user ownership, and temporary-to-active state in backend/tests/contract/profile-avatar.spec.ts
- [X] T026 [P] [US2] Write avatar storage unit tests for random keys, owner isolation, state transitions, replacement, and temporary expiry in backend/tests/unit/avatar-storage.test.ts
- [X] T027 [P] [US2] Write AvatarField integration tests for local preview, object URL cleanup, upload errors, draft preservation, and successful summary update in frontend/tests/integration/AvatarField.test.tsx

### Implementation for User Story 2

- [X] T028 [P] [US2] Implement ProfileImage records, owner-scoped lookup, temporary expiry, activation, and superseding in backend/src/modules/user/avatar-storage.ts
- [X] T029 [US2] Implement bounded in-memory multipart parsing, MIME signature/decode validation, normalization, and temporary image creation in backend/src/modules/user/profile.controller.ts
- [X] T030 [US2] Integrate owner validation and atomic temporary-to-active avatar transition with profile updates in backend/src/modules/user/profile.service.ts
- [X] T031 [US2] Add typed multipart upload client with progress/error mapping and imageId response handling in frontend/src/features/profile/services/profileApi.ts
- [X] T032 [US2] Implement fixed-size accessible avatar picker, local preview, validation feedback, cancel/reset, and object URL cleanup in frontend/src/features/profile/components/AvatarField.tsx
- [X] T033 [US2] Integrate avatar upload draft, preview, save activation, and original-avatar rollback into frontend/src/features/profile/hooks/useProfileForm.ts and frontend/src/features/profile/components/ProfileForm.tsx

**Checkpoint**: P2 头像上传与保存可作为 P1 上的独立增量验证，失败不会改变当前头像或文本草稿

---

## Phase 5: User Story 3 - 安全处理无效输入与未保存变更 (Priority: P3)

**Goal**: 用户在并发冲突、网络/保存失败、登录失效和带草稿离开时获得准确反馈且不会无意丢失或覆盖资料

**Independent Test**: 用两个窗口制造版本冲突，模拟 5xx/网络错误和令牌失效，并在有草稿时执行应用内跳转与浏览器刷新；确认无静默覆盖、草稿按规则保留且未授权保存被拒绝

### Tests for User Story 3 ⚠️

- [X] T034 [P] [US3] Extend profile contract tests for stale-version 409 currentProfile, unauthorized writes, malformed requests, and zero partial mutations in backend/tests/contract/profile.spec.ts
- [X] T035 [P] [US3] Extend ProfileForm integration tests for 409 reload decision, network retry, 401 redirect semantics, error-summary focus, and dirty reset rules in frontend/tests/integration/ProfileForm.resilience.test.tsx
- [X] T036 [P] [US3] Write Playwright scenarios for unsaved navigation, browser refresh prompt, two-window conflict, failed-save retention, expired login, keyboard flow, and axe checks in frontend/tests/e2e/profile-edit.spec.ts

### Implementation for User Story 3

- [X] T037 [US3] Return structured 409 currentProfile without retry or mutation when expectedVersion is stale in backend/src/modules/user/profile.service.ts and backend/src/modules/user/profile.controller.ts
- [X] T038 [US3] Add profile-route malicious input protection and safe logging that excludes bio, image contents, and tokens in backend/src/app.ts and backend/src/common/logs/security-log.service.ts
- [X] T039 [US3] Implement explicit conflict state, reload-latest action, retryable network failure state, and 401-safe draft behavior in frontend/src/features/profile/hooks/useProfileForm.ts
- [X] T040 [US3] Add application navigation blocking and browser beforeunload protection driven only by actual unsaved changes in frontend/src/features/profile/hooks/useUnsavedChanges.ts
- [X] T041 [US3] Integrate conflict dialog, unsaved-change confirmation, error-summary focus, and non-destructive retry controls in frontend/src/features/profile/components/ProfileForm.tsx
- [X] T042 [US3] Add responsive profile styles, visible focus, fixed avatar geometry, reduced-motion support, and validation/status states using design tokens in frontend/src/styles/global.css

**Checkpoint**: 三个用户故事均可验证；冲突、失败、鉴权和离开路径不会误报成功或静默丢失数据

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 完成跨故事的一致性、文档和宪章质量门禁

- [X] T043 [P] Add Storybook stories and a11y states for ProfileForm, AvatarField, TextField, GenderField, and BirthdayField in frontend/src/features/profile/components/ProfileForm.stories.tsx
- [X] T044 [P] Update feature overview, route, API, test account, and validation commands in README.md
- [X] T045 Review profile request limits, temporary image cleanup, log redaction, and authorization invariants against specs/002-edit-user-profile/contracts/profile-endpoints.md and document verified results in specs/002-edit-user-profile/quickstart.md
- [X] T046 Run typecheck, lint, unit, integration, contract, build, Playwright, and axe quality gates and record any environment-specific validation notes in specs/002-edit-user-profile/quickstart.md
- [X] T047 Validate LCP, INP, CLS, 2-second feedback target, responsive layouts, and complete keyboard/screen-reader flow, then record results in specs/002-edit-user-profile/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 无依赖，可立即开始；T002/T003 可并行
- **Phase 2 Foundational**: 依赖 Phase 1，阻塞全部用户故事；T005/T009 可与不修改相同文件的任务并行
- **Phase 3 US1**: 依赖 Phase 2，交付可运行 MVP
- **Phase 4 US2**: 依赖 US1 的资料保存管线，作为头像增量独立验收
- **Phase 5 US3**: 依赖 US1 的资料保存管线；可在 US2 之后或与不触碰相同文件的 US2 测试准备并行
- **Phase 6 Polish**: 依赖计划纳入交付的全部用户故事完成

### User Story Dependencies

- **US1 (P1)**: 仅依赖 Foundational，是 MVP，无其他故事依赖
- **US2 (P2)**: 复用 US1 的 ProfileChange 原子保存和 Auth Store 同步，但头像上传/拒绝路径可独立测试
- **US3 (P3)**: 复用 US1 的版本化保存；未保存保护和错误恢复不依赖 US2，头像草稿保护验收在 US2 完成后加入

### Within Each User Story

- 测试任务先创建并确认失败，再开始实现
- shared schema/repository 基础先于 service，service 先于 controller
- API 客户端和独立字段组件可并行，随后由 hook 和 ProfileForm 组合
- 每个故事在进入下一优先级前通过其 Independent Test

### Parallel Opportunities

- Setup: T002 与 T003
- Foundation: T005 与 T009；T006/T007 在不同文件可并行，但 T008 需等待 T007
- US1 tests: T010~T013；US1 components/client: T014~T018
- US2 tests: T025~T027；T028 可与 T027 并行
- US3 tests: T034~T036；T040 可在 T039 后独立实现
- Polish: T043 与 T044

---

## Parallel Example: User Story 1

```text
Task: T010 Contract tests in backend/tests/contract/profile.spec.ts
Task: T011 Repository tests in backend/tests/unit/user-profile.repository.test.ts
Task: T012 Schema tests in frontend/tests/unit/profileSchema.test.ts
Task: T013 Form integration tests in frontend/tests/integration/ProfileForm.test.tsx

After shared contracts are stable:
Task: T014 UI schema adapter in frontend/src/features/profile/schemas/profileSchema.ts
Task: T015 API client in frontend/src/features/profile/services/profileApi.ts
Task: T016 TextField in frontend/src/features/profile/components/TextField.tsx
Task: T017 GenderField in frontend/src/features/profile/components/GenderField.tsx
Task: T018 BirthdayField in frontend/src/features/profile/components/BirthdayField.tsx
```

## Parallel Example: User Story 2

```text
Task: T025 Avatar contract tests in backend/tests/contract/profile-avatar.spec.ts
Task: T026 Avatar storage tests in backend/tests/unit/avatar-storage.test.ts
Task: T027 AvatarField tests in frontend/tests/integration/AvatarField.test.tsx
```

## Parallel Example: User Story 3

```text
Task: T034 Conflict/auth contract tests in backend/tests/contract/profile.spec.ts
Task: T035 Resilience integration tests in frontend/tests/integration/ProfileForm.resilience.test.tsx
Task: T036 Browser/E2E/a11y tests in frontend/tests/e2e/profile-edit.spec.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Setup 和 Foundational。
2. 完成 US1 的失败测试及实现 T010~T024。
3. 运行 US1 契约、repository、schema 和表单集成测试。
4. 手工执行“编辑并保存基础资料” Independent Test。
5. 停止并评审 MVP；不需要头像和异常增强也可演示核心价值。

### Incremental Delivery

1. Setup + Foundational → 跨端资料基础就绪。
2. US1 → 基础资料 MVP。
3. US2 → 头像预览、上传与生命周期。
4. US3 → 冲突、失败恢复、鉴权与未保存保护。
5. Polish → Storybook、文档、性能和完整质量门禁。

### Parallel Team Strategy

基础阶段完成后：

- 开发者 A 负责 US1 后端 repository/service/controller。
- 开发者 B 负责 US1 前端字段组件和 schema。
- 开发者 C 负责 US1 测试与 API client/hook 集成。
- US1 验收后，以同样文件所有权拆分 US2 与 US3，避免并行修改 `ProfileForm.tsx`、`profile.service.ts`。

## Notes

- `[P]` 仅标记可安全并行且不修改同一文件的任务。
- `[US#]` 提供从实现回溯到用户故事的可追踪性。
- 每个任务均包含具体文件路径；多文件任务仅用于不可分割的装配或集成变更。
- 先观察测试失败，再实现对应行为；每个 checkpoint 可独立验收。
- 不在任务执行中扩大到手机号、密码、实名认证、头像裁剪或隐私权限配置。

## Phase 7: Convergence

- [X] T048 CRITICAL configure measurable 80% business-logic and 60% rendering-code coverage thresholds and a failing CI-compatible coverage command in backend/vitest.config.ts, frontend/vitest.config.ts, packages/shared-schemas/package.json, and package.json per Constitution V (missing)
- [X] T049 CRITICAL add repeatable Playwright performance measurements for LCP, INP, CLS, and profile-save feedback latency with asserted budgets in frontend/tests/e2e/profile-performance.spec.ts per Constitution III and SC-002 (partial)
- [X] T050 CRITICAL add independently renderable default, error, disabled, keyboard, and accessibility stories or interaction tests for ProfileForm, AvatarField, TextField, GenderField, and BirthdayField in frontend/src/features/profile/components/ProfileForm.stories.tsx per Constitution II and T043 (partial)
- [X] T051 display the authenticated masked phone plus an explicit explanation that phone, password, and identity fields are managed outside this form in frontend/src/pages/EditProfilePage.tsx and frontend/src/features/profile/components/ProfileForm.tsx per FR-002 and US1/AC1 (partial)
- [X] T052 preserve the pre-conflict local draft and provide explicit compare, restore, or discard actions when loading currentProfile in frontend/src/features/profile/hooks/useProfileForm.ts, frontend/src/features/profile/components/ProfileForm.tsx, and frontend/tests/integration/ProfileForm.resilience.test.tsx per FR-013 and SC-004 (partial)
- [X] T053 reject declared MIME and decoded image-format mismatches while accepting only JPEG, PNG, and WebP in backend/src/modules/user/profile.controller.ts and backend/tests/contract/profile-avatar.spec.ts per contract: avatar MIME validation (contradicts)
- [X] T054 implement deletion of expired temporary avatar buffers with an injectable clock and deterministic cleanup tests in backend/src/modules/user/avatar-storage.ts and backend/tests/unit/avatar-storage.test.ts per research: temporary cleanup and T028 (missing)
- [X] T055 complete the promised avatar, resilience, authentication, two-window conflict, browser-refresh, keyboard, and failure-recovery coverage in backend/tests/contract/profile-avatar.spec.ts, frontend/tests/integration/ProfileForm.resilience.test.tsx, and frontend/tests/e2e/profile-edit.spec.ts per T025, T026, T035, and T036 (partial)
- [X] T056 expose accessible avatar upload progress through frontend/src/features/profile/services/profileApi.ts, frontend/src/features/profile/hooks/useProfileForm.ts, frontend/src/features/profile/components/AvatarField.tsx, and frontend/tests/integration/AvatarField.test.tsx per T031 (partial)
