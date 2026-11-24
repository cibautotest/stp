# 验收用例清单：login-captcha

## 单元测试（backend/platform-service/src/test/java/com/smarttesting/platform/service/CaptchaServiceTest.java）

| # | 用例 | 覆盖点 | 状态 |
|---|---|---|---|
| U1 | generate：key 32 位、PNG data URI（魔数校验）、明文码 4 位且匹配字符集（排除 0/O/1/I/l） | 生成 | 通过 |
| U2 | verify：正确验证码 → true，二次使用同 key → false | 一次性消费（防重放） | 通过 |
| U3 | verify：错误验证码 → false 且 key 被消费 | 失败后旧码不可用 | 通过 |
| U4 | verify：小写输入 → true | 忽略大小写 | 通过 |
| U5 | verify：不存在 key → false | 边界 | 通过 |
| U6 | verify：null/空白 key/code 安全返回 false | 边界 | 通过 |

## 用户自测清单（运行环境）

| # | 步骤 | 预期 |
|---|---|---|
| A1 | 打开登录页 | 验证码图片展示（4 位字符、干扰线），点击图片可刷新 |
| A2 | 不填验证码直接登录 | 表单校验拦截"请输入验证码" |
| A3 | 输入错误验证码 + 正确账号密码 | 提示"验证码错误或已过期"，验证码图片自动刷新 |
| A4 | 输入正确验证码（大小写均可）+ 正确账号密码 | 登录成功进入 /home |
| A5 | 正确验证码 + 错误密码 | 提示"用户名或密码错误"，验证码自动刷新（旧码已被消费不可再用） |
| A6 | Chrome 插件登录（不带验证码字段） | 不受影响，正常登录（可选校验语义） |
| A7 | 容器环境获取验证码 | 正常出图（Dockerfile 已补 fontconfig；若未重建镜像会 500） |
