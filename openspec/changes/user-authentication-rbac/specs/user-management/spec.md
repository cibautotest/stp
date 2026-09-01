# Capability: 用户管理

## 描述

提供用户 CRUD 及项目权限分配管理功能，仅 `sysadmin` 角色可访问。

## 角色定义

| 角色 | 枚举值 | 权限说明 |
|------|--------|---------|
| 系统管理员 | `sysadmin` | 全量数据可见 + 用户管理 + AI 配置管理 |
| 普通用户 | `general` | 仅可见关联项目的数据，不可见用户管理和配置管理页 |

## 接口规范

### GET /api/platform/users

分页查询用户列表（仅 sysadmin）。

**请求参数：** `page`, `size`, `keyword`（可选，按用户名搜索）

**响应：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 10,
    "page": 1,
    "size": 10,
    "items": [
      {
        "id": 1,
        "username": "sysadmin",
        "displayName": "系统管理员",
        "role": "sysadmin",
        "status": 1,
        "lastLoginAt": "2026-05-21 10:00:00",
        "createdAt": "2026-05-21 00:00:00"
      }
    ]
  }
}
```
> 注意：密码字段永不返回。

### POST /api/platform/users

创建用户（仅 sysadmin）。

**请求体：**
```json
{
  "username": "user1",
  "password": "password123",
  "displayName": "用户1",
  "role": "general"
}
```

**校验规则：**
- username：必填，2-64 字符，唯一
- password：必填，6-128 字符
- role：必填，值必须在 `[sysadmin, general]` 范围内

### PUT /api/platform/users/{id}

更新用户信息（仅 sysadmin）。可更新：`displayName`, `password`, `role`, `status`。

> 如果 `password` 为空字符串则忽略密码更新。

### DELETE /api/platform/users/{id}

删除用户（仅 sysadmin，软删除）。**不允许删除自己**。

### GET /api/platform/users/{id}/projects

查询用户已关联的项目列表。

### POST /api/platform/users/{id}/projects

为用户分配项目权限。

**请求体：**
```json
{
  "projectIds": ["uuid-1", "uuid-2", "uuid-3"]
}
```

> 会覆盖之前的分配（先删除旧的关联，再批量插入新的）。

### DELETE /api/platform/users/{id}/projects/{projectId}

移除用户的某个项目权限。

## 前端用户管理页

- 用户列表表格：ID、用户名、显示名、角色、状态、最后登录时间、操作
- 操作列：编辑、分配项目、删除
- 创建/编辑弹窗：用户名、密码、显示名、角色下拉框
- 分配项目弹窗：多选项目列表（显示名称），确定后关联
