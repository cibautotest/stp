# Capability: 用户登录认证

## 描述

提供 JWT 令牌登录认证能力，用户通过用户名+密码登录系统，服务端验证身份后返回 JWT Token。

## 接口规范

### POST /api/platform/auth/login

**请求体：**
```json
{
  "username": "sysadmin",
  "password": "admin123"
}
```

**成功响应 (200)：**
```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "username": "sysadmin",
      "displayName": "系统管理员",
      "role": "sysadmin"
    }
  }
}
```

**失败响应 (401)：**
```json
{
  "code": 401,
  "message": "用户名或密码错误",
  "data": null
}
```

### GET /api/platform/auth/me

获取当前登录用户信息。需携带 `Authorization: Bearer <token>`。

**成功响应：**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "username": "sysadmin",
    "displayName": "系统管理员",
    "role": "sysadmin"
  }
}
```

**未登录响应 (401)：**
```json
{
  "code": 401,
  "message": "未登录或 Token 已过期",
  "data": null
}
```

## 错误码

| 状态码 | 说明 |
|--------|------|
| 401 | 认证失败（密码错误/token无效/过期） |
| 403 | 无权限访问 |

## Token 规范

| 属性 | 值 |
|------|-----|
| 算法 | HMAC-SHA256 (HS256) |
| Header | `alg: HS256`, `typ: JWT` |
| Payload | `sub`(userId), `username`, `role`, `iat`, `exp` |
| 有效期 | 24 小时 |
| 传递方式 | `Authorization: Bearer <token>` |

## 密码验证

- 使用 `BCryptPasswordEncoder.matches(rawPassword, encodedPassword)` 验证
- 不泄露明文密码或加密后的密文给前端
- 不返回密码字段（即使是脱敏的）
