# 验收结论报告：login-captcha

## 功能

平台登录页图形验证码校验：
- 后端 `GET /api/platform/auth/captcha`（免鉴权）返回 `{key, image}`（PNG base64，4 位、排除易混淆字符、5 分钟过期、一次性消费）；
- `POST /auth/login` 带 captchaKey 时强校验，错误返回 400 "验证码错误或已过期"；不带则跳过（兼容 Chrome 插件直连）；
- 前端登录页：验证码输入行（点击图片刷新），登录失败自动刷新验证码，axios 400 优先展示后端 error 文案。

## 改动清单

| 层 | 文件 | 改动 |
|---|---|---|
| 后端 | `model/CaptchaResponse.java` | 新增 |
| 后端 | `service/CaptchaService.java` | 新增（Java 原生绘图，零新依赖） |
| 后端 | `model/LoginRequest.java` | +captchaKey/captchaCode（可选字段，向后兼容） |
| 后端 | `controller/AuthController.java` | +captcha 端点；login 验证码校验 |
| 后端 | `security/SecurityConfig.java` | 白名单 +/auth/captcha |
| 后端 | `Dockerfile` | +fontconfig fonts-dejavu-core（jre-slim 缺字体绘图会异常） |
| 后端 | `test/.../CaptchaServiceTest.java` | 新增 6 用例 |
| 前端 | `api/auth.ts` | +getCaptcha；login 透传验证码 |
| 前端 | `api/axios.ts` | 400 且带 error 文案时优先展示（login-captcha 及所有 400 接口受益） |
| 前端 | `stores/auth.ts` | login 透传 + 验证码错误 rethrow |
| 前端 | `views/login/index.vue` | 验证码 UI + 失败自动刷新 |

## 验证结论

后端编译/单测（6/6）、前端 lint/build 全部通过；运行时验收由用户执行（A1-A7）。
**变更暂不归档**，待用户自测通过后再 archive。

## 部署清单

- platform-service jar（或重建 stp-platform 镜像——**Dockerfile 有变更，必须重建镜像**，否则容器内验证码绘图 500）
- 前端 dist（或重建 stp-frontend 镜像）
- 无 SQL 迁移

## 风险提示

- 可选校验语义下，直连 API 可绕过验证码（插件兼容的权衡，见 proposal）；
- `AuthService.login` 密码比对逻辑被注释是历史遗留（与本次无关），建议尽快恢复。
