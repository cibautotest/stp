## ADDED Requirements

### Requirement: 登录图形验证码

系统 SHALL 提供图形验证码能力用于登录页人机校验。

#### Scenario: 获取验证码
- **WHEN** 调用 `GET /api/platform/auth/captcha`（免鉴权）
- **THEN** 系统 SHALL 返回 `{key, image}`，image 为 PNG base64 data URI，key 对应的验证码 5 分钟内有效

#### Scenario: 登录携带验证码时强校验
- **WHEN** 登录请求携带非空 captchaKey
- **THEN** 系统 SHALL 校验验证码（忽略大小写）；错误/过期/已使用时返回 400 `{"error":"验证码错误或已过期"}`，且该验证码被消费不可再用
- **AND** 校验通过或失败，该 key 均从存储中移除（一次性）

#### Scenario: 兼容不带验证码的客户端
- **WHEN** 登录请求不含 captchaKey（如 Chrome 插件直连）
- **THEN** 系统 SHALL 跳过验证码校验，按原登录流程处理

#### Scenario: 验证码属性
- 验证码 SHALL 为 4 位、字符集排除易混淆字符（0/O/1/I/l 等）

### Requirement: 前端登录页验证码交互

登录页 SHALL 展示验证码图片与输入框：点击图片可刷新；登录失败（用户名密码错误或验证码错误）后自动刷新验证码并清空输入；验证码错误提示展示后端返回的 error 文案。
