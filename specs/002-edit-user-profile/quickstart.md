# Quickstart Validation: 用户资料编辑

**Feature**: [spec.md](spec.md)  
**Plan**: [plan.md](plan.md)  
**Contract**: [profile-endpoints.md](contracts/profile-endpoints.md)

本指南用于在实现后验证端到端行为，不包含实现代码。

## 1. 前置条件

- Node.js 20+
- 根目录依赖已安装：`npm install`
- 使用现有测试账号 `13800000001` / `Password123!`，测试验证码 `135792`
- 本地后端使用内存存储；如切换真实存储，需先准备对应服务

## 2. 启动项目

```bash
npm run dev
```

打开 `http://localhost:5173/login`，完成登录后进入 `/profile/edit`。

## 3. 自动化质量门禁

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

预期：全部命令退出码为 0；业务逻辑覆盖率至少 80%，渲染代码至少 60%；资料编辑 E2E 不出现严重 axe 违规。

## 4. 核心验收场景

### 场景 A：读取并保存基础资料（P1）

1. 登录并打开 `/profile/edit`。
2. 确认页面预填当前昵称、简介、性别、生日和头像。
3. 将昵称改为“新的昵称”，简介填写多语言文字与表情，保存。
4. 观察成功反馈，返回 Dashboard，再重新进入编辑页。

预期：两处昵称立即一致；重新进入后字段保持最新值；响应版本递增一次。

### 场景 B：字段级校验与原子性（P3）

1. 输入仅空格的昵称和未来生日，其他字段同时做合法修改。
2. 点击保存。

预期：昵称和生日均有与字段关联的错误；焦点可到达错误摘要/首个错误；任何字段均未写入。

### 场景 C：头像预览与保存（P2）

1. 选择一张小于 5 MB 的 JPEG/PNG/WebP。
2. 确认保存前可预览且页面没有布局跳动。
3. 保存资料并刷新 Dashboard。

预期：上传返回 temporary imageId；资料保存后头像成为 active；页头和编辑页展示一致。

### 场景 D：不合规头像（P2）

分别选择超过 5 MB 的图片、伪装成图片的文本文件、损坏图片和 SVG。

预期：每种文件均被拒绝并说明原因；原头像保持不变；资料文本草稿仍在。

### 场景 E：未保存变更（P3）

1. 修改简介但不保存，尝试应用内跳转。
2. 选择继续编辑，再尝试刷新浏览器。
3. 返回页面后保存成功，再离开。

预期：前两次均出现未保存提醒；取消离开时草稿保留；保存后不再提示。

### 场景 F：并发冲突（P3）

1. 在两个浏览器窗口打开同一账号资料，记录相同版本。
2. 窗口 A 修改并保存。
3. 窗口 B 使用旧版本提交另一修改。

预期：A 成功；B 返回 409 并提示加载最新资料，B 不覆盖 A 的内容，也不自动重试。

### 场景 G：登录失效（P3）

在编辑后、保存前使 Access/Refresh Token 失效，再点击保存。

预期：服务端不写入资料；客户端清除登录态并引导重新登录；不得显示保存成功。

## 5. API 契约验证

Supertest 契约测试至少覆盖：

- 未鉴权访问三个接口均被拒绝
- GET 只能返回 token 对应用户
- PATCH 正常更新、字段错误、未来生日、无效头像引用、409 冲突和原子回滚
- avatar 上传的三种允许格式、5 MB 边界、内容嗅探、损坏文件和跨用户 imageId

具体请求和响应形状以 [接口契约](contracts/profile-endpoints.md) 为准，数据约束以 [数据模型](data-model.md) 为准。

## 6. 可访问性与性能观察

- 仅使用键盘完成进入页面、修改全部字段、选择头像、保存和处理错误。
- 屏幕阅读器能够读出字段名称、必填状态、字符限制、错误和保存结果。
- 头像预览固定尺寸，加载前后不造成可见布局移动。
- 用性能测试确认 LCP ≤ 2.5s、INP ≤ 200ms、CLS ≤ 0.1，且 95% 的资料读取/保存操作在 2 秒内反馈。

## 7. Implementation Validation Record

**Validated**: 2026-09-02

### Automated gates

| Gate | Result | Evidence |
|------|--------|----------|
| TypeScript strict | PASS | `npm run typecheck`，3/3 workspaces passed |
| ESLint | PASS | `npm run lint`，0 errors/warnings |
| Unit/integration/contract | PASS | `npm test`：shared 8、frontend 20、backend 36，共 64 tests |
| Production build | PASS | `npm run build`；EditProfilePage lazy chunk 7.76 kB (3.44 kB gzip) |
| Playwright E2E | PASS | 7/7 tests；资料编辑完整流程 1.2s |
| Storybook a11y | PASS | 9/9 stories；资料默认/错误态均无 axe violations |

### Security and contract review

- 三个资料接口均由 `requireAuth` 保护，用户 ID 只取自令牌 `sub`。
- JSON 资料请求继续受 input guard 保护；日志只记录用户 ID、版本、图片 ID、大小和媒体类型，不记录 bio、图片内容或令牌。
- multipart 仅接受单文件并在内存层限制 5 MB；服务端使用 Sharp 解码真实内容并统一输出 WebP，文件扩展名和客户端 MIME 不作为信任依据。
- PATCH 先校验完整 payload 和头像所有权，再执行单次版本化更新；409 返回最新资料且不自动重试。
- 临时头像按所有者隔离并带 24 小时过期时间；激活新头像时旧头像进入 superseded 状态。

### Performance and accessibility review

- 资料页面保持路由懒加载；构建产物 gzip 3.44 kB，未扩大登录首屏路由 chunk。
- 头像预览固定 96×96，图片明确 width/height，Playwright + axe 未发现 WCAG 2.1 AA 违规。
- 资料 E2E（包含登录、页面加载、修改、离开保护、保存和 axe）完成时间 1.2s；保存反馈满足 SC-002 的 2 秒目标。
- 表单使用原生输入、fieldset/legend、`aria-describedby`、`aria-live` 和可见焦点；支持 reduced-motion。
