## ADDED Requirements

### Requirement: 登录方式内容变更后缓存失效

系统 SHALL 在登录方式核心字段（type / loginUrl / username / password / stepsNlp / yamlScript）发生变更时，将其 cacheStatus 重置为 uncached，确保执行时重新登录生成缓存。

#### Scenario: 修改账号密码
- **WHEN** 登录方式的 username 或 password 被更新
- **THEN** cacheStatus SHALL 重置为 uncached

#### Scenario: 未变化的字段提交（null 表示不修改）
- **WHEN** 提交载荷中某字段为 null 或与库中值一致
- **THEN** 该字段 SHALL 不视为变化，cacheStatus 保持原值

### Requirement: 用例详情页登录方式管理

用例详情页 SHALL 提供登录方式编辑入口，支持：换绑（含免登录解绑）、编辑登录方式内容（类型/登录网址/账号/密码/补充步骤）、新建登录方式并绑定、删除登录方式（先解绑当前用例；被其他用例引用时展示后端拒绝原因）。

#### Scenario: 编辑保存
- **WHEN** 用户修改登录方式表单并保存
- **THEN** 系统 SHALL 调用 `PUT /login-methods/{id}`，name/roleName 随账号同步为 `{type}登录-{账号}`/账号，补充步骤以 `[动态] ` 前缀行存入 stepsNlp

#### Scenario: 删除被引用的登录方式
- **WHEN** 登录方式仍被其他用例绑定
- **THEN** 删除 SHALL 被后端拒绝，前端展示错误信息
