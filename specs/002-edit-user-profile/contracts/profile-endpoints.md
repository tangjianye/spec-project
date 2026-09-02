# Contracts: 用户资料 API

**Created**: 2026-09-02  
**Feature**: [spec.md](../spec.md)  
**Data Model**: [data-model.md](../data-model.md)

## 通用约定

- Base URL: `/api/v1/profile`
- 所有接口必须携带 `Authorization: Bearer <access_token>`，并沿用现有静默刷新机制。
- JSON 接口沿用 `{ code, message, data, requestId }` 成功信封和 `{ code, message, errors, requestId }` 错误信封。
- 日期为 `YYYY-MM-DD`；时间为 UTC ISO 8601。

### 新增错误码

| code | HTTP | message | 场景 |
|------|------|---------|------|
| 20001 | 400 | 个人资料内容不符合要求 | 字段校验失败，具体字段见 errors |
| 20002 | 409 | 资料已在其他位置更新，请加载最新内容后重试 | expectedVersion 过期 |
| 20003 | 400 | 请选择 JPEG、PNG 或 WebP 图片 | 文件类型不支持或内容不匹配 |
| 20004 | 413 | 头像图片不能超过 5 MB | 文件超过限制 |
| 20005 | 400 | 头像文件无法读取，请重新选择 | 损坏或无法解码 |
| 20006 | 400 | 头像不可用，请重新上传 | imageId 不存在、不属于当前用户或状态不可绑定 |

现有 `10011/10012` 分别表示登录过期和凭证无效，仍由全局鉴权链路处理。

## 1. 读取当前用户资料

```http
GET /api/v1/profile
Authorization: Bearer <access_token>
```

### 成功响应（200）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "userId": "u_0001",
    "nickname": "用户一",
    "bio": "保持好奇。",
    "gender": "undisclosed",
    "birthDate": "1995-08-20",
    "avatarImageId": null,
    "avatarUrl": "",
    "version": 3,
    "updatedAt": "2026-09-02T06:00:00.000Z"
  },
  "requestId": "req_profile_001"
}
```

返回值必须来自 token 中 `sub` 对应的用户，客户端不得指定 userId。

## 2. 更新当前用户资料

```http
PATCH /api/v1/profile
Authorization: Bearer <access_token>
Content-Type: application/json
```

### 请求体

```json
{
  "expectedVersion": 3,
  "nickname": "新的昵称",
  "bio": "新的个人简介",
  "gender": "undisclosed",
  "birthDate": "1995-08-20",
  "avatarImageId": "img_9fd1"
}
```

| 字段 | 类型 | 必填 | 规则 |
|------|------|------|------|
| expectedVersion | positive integer | 是 | 必须等于当前资料版本 |
| nickname | string | 是 | trim 后 2~30 可见字符 |
| bio | string \| null | 是 | ≤ 200 字符 |
| gender | enum \| null | 是 | female/male/other/undisclosed/null |
| birthDate | string \| null | 是 | YYYY-MM-DD 且不晚于今天 |
| avatarImageId | string \| null | 是 | 当前用户拥有的 active/temporary 图片或 null |

### 成功响应（200）

`data` 返回更新后的完整 UserProfile，其中 `version` 为请求版本加 1。客户端必须用该响应同时替换表单基准值和 Auth Store 中的 nickname/avatarUrl 摘要。

### 字段校验失败（400 / code 20001）

```json
{
  "code": 20001,
  "message": "个人资料内容不符合要求",
  "errors": [
    { "field": "nickname", "message": "昵称需为 2 至 30 个字符" }
  ],
  "requestId": "req_profile_002"
}
```

### 并发冲突（409 / code 20002）

```json
{
  "code": 20002,
  "message": "资料已在其他位置更新，请加载最新内容后重试",
  "errors": [],
  "data": {
    "currentProfile": { "userId": "u_0001", "version": 4 }
  },
  "requestId": "req_profile_003"
}
```

冲突响应中的 `currentProfile` 实际返回完整资料；客户端不得自动重放或覆盖，必须提示用户重新加载。

## 3. 上传头像候选图片

```http
POST /api/v1/profile/avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

表单字段只有一个：`avatar`。最大 5 MB，允许 JPEG、PNG、WebP；客户端 `accept` 仅用于体验，服务端必须验证真实文件内容。

### 成功响应（201）

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "imageId": "img_9fd1",
    "previewUrl": "/media/profile/img_9fd1.webp",
    "mediaType": "image/webp",
    "byteSize": 182340,
    "expiresAt": "2026-09-03T06:00:00.000Z"
  },
  "requestId": "req_profile_004"
}
```

成功上传的图片处于 temporary 状态；只有后续 PATCH 引用 `imageId` 并成功提交后才成为 active。失败响应使用 20003~20005，且不得改变当前头像。

## 契约不变量

1. 三个接口均只作用于当前登录用户。
2. PATCH 原子更新资料；任意字段或头像引用失败时全部不生效。
3. 409 不得由客户端静默重试。
4. 上传响应 URL 只用于预览；PATCH 只接受服务端 `imageId`，不接受任意 URL。
5. 日志不得记录完整 bio、原始头像内容或鉴权令牌。
