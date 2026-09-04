# 规格 — 登录方式复用

## ADDED Requirements

### Requirement: 登录方式资产（按项目维度）

平台 SHALL 提供登录方式管理（CRUD），字段含类型（none/cas/local）、名称、登录网址、账号、密码（加密）、角色名、补充步骤 NLP、yaml_script、缓存状态。同类型 SHALL 支持多角色。

### Requirement: 创建用例必选登录方式

创建用例页面 SHALL 在选择项目下方提供登录方式区块（三种类型单选），未选择时 SHALL 禁止执行。选择免登录后 SHALL 直接进入后续流程；选择 CAS/本地登录时 SHALL 提供角色下拉（含"➕ 新建角色"）、缓存状态标记（"已执行过，有缓存"/"未缓存"），并默认选中上次执行的角色。

### Requirement: 登录阶段独立缓存执行

执行含非免登录方式的用例时，执行引擎 SHALL 先以独立缓存 ID（`login_{methodId}`）执行登录 YAML（首次 AI 生成并写缓存，后续命中缓存），随后**不关闭浏览器**，在同一页面上下文继续执行用例主体（`caseId` 缓存）。登录阶段成功完成后 SHALL 回调平台将 `cache_status` 更新为 `cached`。

#### Scenario: 第二次执行命中登录缓存

- **WHEN** 用例 A、B 绑定同一 CAS 登录方式，A 已执行过一次
- **THEN** 执行 B 时登录阶段命中 `login_{methodId}` 缓存，显著提速，且浏览器未中断直接执行 B 的业务步骤

### Requirement: 动态步骤不缓存

YAML 生成时，被 `[动态]` 标记或其内容每次执行不同的步骤（图形验证码、短信验证码、当前日期、随机值）SHALL 输出 `cacheable: false`；固定值步骤不标记；查询/断言类步骤无需标记（官方永不缓存）。

### Requirement: 插件侧选择与同步

插件导出弹窗 SHALL 提供登录方式下拉（数据与平台同步，含新建选项），一键同步 SHALL 携带 `loginMethodId`。

## MODIFIED Requirements

### Requirement: 用例执行请求

`POST /api/platform/execute/create-and-execute` 请求体 SHALL 支持 `loginMethodId` 字段。存量用例未携带时 SHALL 按免登录兼容执行。
