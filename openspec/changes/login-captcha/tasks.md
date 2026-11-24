# Tasks: login-captcha

- [x] 1. 后端：`CaptchaResponse` 模型 + `CaptchaService`（绘图/内存存储/verify 一次性校验）
- [x] 2. 后端：`LoginRequest` 扩展 + `AuthController`（captcha 端点 + 登录验证码校验）+ `SecurityConfig` 白名单
- [x] 3. 后端：`Dockerfile` 补 fontconfig 字体
- [x] 4. 后端单测：`CaptchaServiceTest` 6/6 通过
- [x] 5. 后端编译通过（COMPILE_EXIT=0）
- [x] 6. 前端：api/auth.ts + stores/auth.ts + axios 400 文案 + 登录页验证码 UI
- [x] 7. 前端 `read_lints` 零错误 + `npm run build` 通过（31.18s）
- [x] 8. verification 资产归档（用户自测项 A1-A7 已列明）
