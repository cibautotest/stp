# Proposal: 平台登录页图形验证码校验

## 背景 (Why)

平台登录页（`/login`）目前仅用户名 + 密码，无任何人机校验；且 `AuthService.login` 中密码校验逻辑当前被注释（历史遗留，本次不动），任何人可反复尝试登录。需要为登录页加图形验证码校验，防止脚本暴力破解/误触登录。

## 目标 (What)

1. 后端新增图形验证码能力（零新增第三方依赖，Java 原生 `BufferedImage`/`Graphics2D` 绘制）：
   - `GET /api/platform/auth/captcha`（免鉴权）：返回 `{key, image}`，image 为 PNG base64 data URI；
   - 登录接口 `POST /auth/login`：请求带 `captchaKey` 时强校验验证码，错误/过期返回 400；
2. 前端登录页：验证码输入行（输入框 + 图片，点击图片刷新），登录时携带验证码，登录失败后自动刷新。

## 关键决策与约束

- **Chrome 插件兼容（可选校验语义）**：插件 `scripts/auth.js` 直接 `POST /auth/login`（仅用户名/密码），本次不改插件。因此后端采用"**带 captchaKey 才强校验，不带则放行**"的可选校验——平台前端登录页始终带验证码，插件不受影响。安全边界说明：该模式对"直连 API 绕过前端"的攻击者无强制力；后续若要求全端强制，需同步改造插件登录流程。
- **验证码属性**：4 位、去掉易混淆字符（0/O/1/I/l 等）、忽略大小写、5 分钟过期、**一次性消费**（verify 即删，登录失败后旧码不可复用）。
- **容器字体**：`openjdk:11-jre-slim` 无 fontconfig，`drawString` 会异常；Dockerfile 增加 `fontconfig fonts-dejavu-core` 安装（需重建镜像生效）。

## 范围 (Scope)

- In：`CaptchaService`（内存存储 + 绘图 + 校验）、`CaptchaResponse`、`LoginRequest` 扩展、`AuthController`（captcha 端点 + 登录校验）、`SecurityConfig` 白名单、前端 `api/auth.ts`/`stores/auth.ts`/`views/login/index.vue`/`api/axios.ts`（400 错误信息展示）、`Dockerfile`（字体）、单测 `CaptchaServiceTest`。
- Out：Chrome 插件改造、Redis/DB 存储验证码（单实例内存 Map 足够）、密码校验逻辑恢复（历史遗留，另行处理）。

## 影响

- 新增 1 个免鉴权端点；登录请求体新增两个可选字段（向后兼容）；无 SQL 迁移。
