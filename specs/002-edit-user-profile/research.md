# Phase 0 Research: 用户资料编辑

**Created**: 2026-09-02  
**Feature**: [spec.md](spec.md)

## 1. 表单状态与跨页面用户摘要

**Decision**: 编辑中的表单状态由 `useProfileForm` 局部管理；仅在保存成功后调用 `useAuthStore` 的资料摘要更新动作，刷新昵称和头像。

**Rationale**: 草稿只属于当前页面，不应污染全局登录态；现有 Zustand store 已是页头等展示位置读取用户摘要的唯一来源。

**Alternatives considered**: 将全部草稿写入 Zustand 会让取消、失败回滚和并发冲突复杂化；引入新的表单库或服务状态库超出本功能需求。

## 2. 前后端校验共享

**Decision**: 在 `@spec/shared-schemas` 中定义 nickname、bio、gender、birthDate、profile update 和版本号 schema，并由前后端共同使用；UI 层只负责错误码到中文提示的映射。

**Rationale**: 项目已有共享 Zod 包，复用可防止两端规则漂移并保持类型由 schema 推导。

**Alternatives considered**: 两端重复声明规则容易产生长度和可选性差异；只依赖服务端校验无法满足即时反馈目标。

## 3. 并发更新策略

**Decision**: 用户资料包含递增整数 `version`；GET 返回版本，PATCH 必须携带客户端读取到的版本。版本不匹配返回 HTTP 409，且不写入任何字段。

**Rationale**: 这是满足 FR-013 的最小显式并发控制方式，能防止不同设备或过期页面静默覆盖。

**Alternatives considered**: 最后写入者胜出违反规格；整行更新时间比较受精度和格式影响；字段级自动合并会隐藏用户决策且增加复杂度。

## 4. 头像上传与资料事务边界

**Decision**: `POST /api/v1/profile/avatar` 单独接收文件、验证内容并返回受控 `imageId` 与预览 URL；资料 PATCH 只提交已成功上传的 `avatarImageId`。未被资料引用的临时头像由存储实现按过期策略清理。

**Rationale**: 二进制上传失败不会破坏文本资料保存；服务端可禁止客户端提交任意外部 URL，并保持资料 PATCH 为小型原子事务。

**Alternatives considered**: Base64 嵌入 JSON 放大请求且增加内存压力；直接接受 URL 有注入和资源所有权风险；把文件和全部资料放进一个 multipart 请求会增加重试与校验复杂度。

## 5. 头像安全与格式

**Decision**: 接受 JPEG、PNG、WebP，最大 5 MB；同时检查声明 MIME、文件头和解码有效性，生成随机服务端文件名，输出固定方形展示位。SVG 和 GIF 不在首版范围。

**Rationale**: 覆盖常见静态头像格式，同时避免 SVG 活跃内容和 GIF 动画/资源消耗风险；与 spec 的 5 MB 默认一致。

**Alternatives considered**: 仅检查扩展名不安全；接受所有 `image/*` 范围过宽；客户端校验不能替代服务端验证。

## 6. 生日与可选字段语义

**Decision**: 生日使用 `YYYY-MM-DD` 的纯日期字符串或 `null`，按服务端当前 UTC 日期拒绝未来值；性别枚举为 `female | male | other | undisclosed | null`，其中 `null` 表示未填写。

**Rationale**: 生日不应受时区转换影响；明确枚举和空值语义便于跨端一致校验，并允许用户清除资料。

**Alternatives considered**: ISO 时间戳会因时区出现日期偏移；自由文本性别难以保证现有产品选项一致；空字符串会产生多种“未填写”状态。

## 7. 未保存变更保护

**Decision**: 通过基准资料与当前草稿比较计算 dirty 状态；应用内导航使用路由阻止/确认，浏览器关闭或刷新使用 `beforeunload`。保存成功后重置基准，保存失败保持草稿。

**Rationale**: 可覆盖 FR-011/FR-012，同时避免无变更时出现干扰性提示。

**Alternatives considered**: 仅监听浏览器关闭无法保护应用内跳转；每次字段变化自动保存会改变用户确认保存的规格语义，并加剧并发冲突。

## 8. 可访问性与性能

**Decision**: 使用原生表单元素、`fieldset/legend`、`aria-describedby`、错误摘要聚焦和 `aria-live` 保存反馈；头像预览固定宽高并及时释放 object URL；资料页路由保持懒加载。

**Rationale**: 与宪章 WCAG 2.1 AA、可见焦点、性能与无布局抖动要求一致。

**Alternatives considered**: 自定义 div 控件会增加键盘与辅助技术负担；未固定图片尺寸会导致 CLS；同步加载新页面代码会扩大已有首屏包。
