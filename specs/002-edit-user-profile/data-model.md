# Data Model: 用户资料编辑

**Created**: 2026-09-02  
**Feature**: [spec.md](spec.md)  
**Contracts**: [profile-endpoints.md](contracts/profile-endpoints.md)

## 1. UserProfile（用户资料）

用户本人可编辑并在产品内展示的资料聚合；与现有 User 账户一对一，共用 `userId`。

| 字段 | 类型 | 必填 | 规则 |
|------|------|------|------|
| userId | string | 是 | 不可修改；来自已验证登录身份 |
| nickname | string | 是 | 去除首尾空白后 2~30 个可见字符 |
| bio | string \| null | 否 | 最多 200 个字符；清除时为 null |
| gender | enum \| null | 否 | `female`、`male`、`other`、`undisclosed` 或 null |
| birthDate | string \| null | 否 | `YYYY-MM-DD`；不得晚于当前日期 |
| avatarImageId | string \| null | 否 | 仅可引用当前用户已上传且可用的 ProfileImage |
| avatarUrl | string | 是 | 服务端根据 avatarImageId 解析；无头像时为空字符串 |
| version | integer | 是 | 从 1 开始，每次成功资料更新递增 1 |
| updatedAt | ISO 8601 string | 是 | 最近一次成功更新的 UTC 时间 |

### 不变量

1. `userId` 永远由鉴权身份确定，请求体不得覆盖。
2. 一次 PATCH 中所有字段和头像引用必须全部校验通过才可提交。
3. 提交的 `version` 必须等于当前存储版本；不匹配时不修改任何字段。
4. 手机号、密码哈希、账户状态等账户安全字段不属于 UserProfile 更新范围。

### 状态转换

```text
Current(vN)
  ├─ valid patch + matching version ─> Current(vN+1)
  ├─ validation failure ─────────────> Current(vN) unchanged
  ├─ version conflict ───────────────> Current(vN) unchanged + conflict
  └─ unauthorized ───────────────────> Current(vN) unchanged
```

## 2. ProfileImage（头像图片）

用户上传并可被资料引用的受控图片资源。

| 字段 | 类型 | 必填 | 规则 |
|------|------|------|------|
| imageId | string | 是 | 服务端生成，不可预测 |
| ownerUserId | string | 是 | 上传者；只能被同一用户资料引用 |
| mediaType | enum | 是 | `image/jpeg`、`image/png`、`image/webp` |
| byteSize | integer | 是 | 1~5,242,880 bytes |
| storageKey | string | 是 | 服务端生成；不得使用原始文件路径 |
| publicUrl | string | 是 | 只读展示地址 |
| status | enum | 是 | `temporary`、`active`、`superseded`、`rejected` |
| createdAt | ISO 8601 string | 是 | 上传完成时间 |
| expiresAt | ISO 8601 string \| null | 否 | temporary 资源清理截止时间 |

### 状态转换

```text
upload -> validate failed -> rejected
upload -> validate passed -> temporary
temporary -> referenced by successful profile patch -> active
active -> replaced by another image -> superseded
temporary -> expires without reference -> deleted by cleanup
```

### 业务规则

- 文件扩展名、声明 MIME 和真实文件内容不一致时拒绝。
- 非 owner 不得读取临时资源或将其绑定到资料。
- 同一用户最多有一个 active 头像；新头像生效后旧头像进入 superseded。
- 上传成功不等于资料已修改；只有 PATCH 成功后新头像才成为 active。

## 3. ProfileChange（资料变更）

客户端与服务端之间的一次资料更新意图，不作为独立长期实体存储。

| 字段 | 类型 | 必填 | 规则 |
|------|------|------|------|
| expectedVersion | integer | 是 | 客户端最后读取的 UserProfile.version |
| nickname | string | 是 | 完整目标值，不是差量操作 |
| bio | string \| null | 是 | 目标值或清除 |
| gender | enum \| null | 是 | 目标值或清除 |
| birthDate | string \| null | 是 | 目标值或清除 |
| avatarImageId | string \| null | 是 | 当前/新头像标识，或 null 表示使用默认头像 |

### 处理结果

- **UPDATED**: 全部校验通过且版本匹配，返回 vN+1 的完整 UserProfile。
- **VALIDATION_FAILED**: 返回字段级错误，不修改资料或头像状态。
- **CONFLICT**: 返回当前最新完整 UserProfile，供用户重新加载后决定。
- **UNAUTHORIZED**: 登录状态无效，不处理变更。

## 4. 关系

```text
UserAccount 1 ─── 1 UserProfile
UserProfile 0 ─── 1 ProfileImage(active)
UserAccount 1 ─── * ProfileImage(all historical/temporary)
ProfileChange * ─── 1 UserProfile(target, transient)
```
