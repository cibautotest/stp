# 验证证据：login-captcha

## 已完成验证（2026-10-16）

| 项 | 结果 | 证据 |
|---|---|---|
| 后端编译 `mvn -q -pl platform-service -am compile -DskipTests` | 通过 | COMPILE_EXIT=0 |
| 单元测试 `mvn -q -pl platform-service test -Dtest=CaptchaServiceTest` | 6/6 通过 | TEST_EXIT=0（含无头环境绘图验证，PNG 魔数断言） |
| 前端 `read_lints`（login/index.vue、api/auth.ts、api/axios.ts、stores/auth.ts） | 零错误 | totalCount=0 |
| 前端完整构建 `npm run build` | 通过 | ✓ built in 31.18s，BUILD_EXIT=0 |

## 未验证项（用户自行测试）

- 运行时验证码全流程（自测清单 A1-A7）；本地平台跑在旧 Docker 镜像，需重新打包 jar 并重建 stp-platform 镜像（Dockerfile 已加 fontconfig，**不重建镜像容器内绘图会 500**）
- 插件登录兼容性实测（A6）

## 行为说明与已知差异

- 登录接口为**可选校验**：带 captchaKey 强校验，不带跳过（Chrome 插件直连 login 不受影响）。安全边界：绕过前端直连 API 可跳过验证码；如需全端强制需同步改造插件 `scripts/auth.js`。
- 登录失败（401/400）后验证码已被后端一次性消费，前端自动刷新。
- 前端登录页 catch 分支不再显示"登录失败，请检查网络连接"（该提示由 axios 拦截器的"网络连接失败"toast 覆盖；网络错误时"用户名或密码错误"提示可能同时出现，为既有双 toast 模式的延续）。
- 遗留提醒（本次未动）：`AuthService.login` 中密码比对逻辑被注释（L59-62），任何密码均可登录——验证码上线后建议尽快恢复密码校验。
