# 规格 — 插件平台对接能力（升级至 Midscene 1.92 基底）

## ADDED Requirements

### Requirement: 插件用户登录（平台认证）

插件侧边栏启动时 SHALL 显示登录遮罩。用户输入平台账号密码后，插件 SHALL 调用 `POST /api/platform/auth/login` 获取 token 与用户信息，并将 token 持久化到 localStorage。

- 登录成功 SHALL 进入项目选择阶段；登录失败 SHALL 显示错误提示（账号/密码错误、网络错误分别提示）
- 插件重启时 SHALL 通过 `GET /api/platform/auth/me`（Bearer token）静默恢复登录态；token 失效时 SHALL 清除本地凭证并回到登录遮罩

#### Scenario: 登录成功

- **WHEN** 用户在登录遮罩输入正确账号密码并点击登录
- **THEN** 遮罩隐藏，显示项目选择弹窗，工具栏不显示用户名
- **AND** token 与用户名写入 localStorage

#### Scenario: 登录后 token 恢复

- **WHEN** 插件重新打开且 localStorage 存在有效 token
- **THEN** 跳过登录遮罩，静默刷新项目列表后进入就绪状态

### Requirement: 项目选择与创建

登录后插件 SHALL 调用 `GET /api/platform/projects?size=100` 拉取用户有权限的项目列表并显示选择弹窗（服务端为唯一数据源，覆盖式刷新本地缓存）。

- 项目列表为空时 SHALL 显示创建引导；选择"创建新项目"SHALL 调用 `POST /api/platform/projects`，创建成功后自动选中新项目
- 确认项目后 SHALL 进入就绪状态（READY）：工具栏显示当前用户与登出按钮，导出按钮启用

#### Scenario: 创建新项目

- **WHEN** 用户在项目弹窗选择"➕ 创建新项目…"并输入名称确认
- **THEN** 调用创建接口成功后，新项目写入本地缓存列表并选中，弹窗关闭，进入就绪状态

### Requirement: 智能选择用例步骤

点击「导出步骤」时，插件 SHALL 从侧边栏对话 DOM（`.user-message-bubble` 元素）按顺序抓取全部用户消息作为候选步骤，默认全部勾选。

- 插件 SHALL 轮询各步骤对应的 AI 响应区段文本，检测到失败特征（Task failed / failed / ✗ / 失败）时自动将该步骤标记为失败、取消勾选并置灰，且用户可手动改选
- 弹窗 SHALL 实时显示「已选择 N / M 个步骤」

#### Scenario: 失败步骤自动排除

- **WHEN** 第 2 条用户消息对应的执行结果包含失败特征
- **THEN** 该步骤自动取消勾选、标记红色 ✗，其余步骤保持勾选，已选择计数同步更新

### Requirement: 一键同步平台

点击「生成用例」时，校验通过后（项目、用例名称、测试网址、至少一个步骤），插件 SHALL 拼接 NLP 文本（`打开{url}，{步骤1}，{步骤2}…`）并调用一步式接口 `POST /api/platform/execute/create-and-execute`（Body: `projectId/name/nlp`，Bearer 认证）。

- 同步成功 SHALL 显示成功提示；执行机离线导致执行失败但用例已创建时 SHALL 显示警告提示（含"离线"说明）
- 401 时 SHALL 清除本地凭证并重新弹出登录遮罩

#### Scenario: 一键同步成功

- **WHEN** 用户填写用例名称、选择项目和步骤后点击「生成用例」
- **THEN** 平台创建用例并触发异步执行，弹窗顶部显示成功横幅

### Requirement: 界面文案规范

插件界面所有用户可见文案中 SHALL NOT 出现「中台」字样，统一使用「平台」。插件名称 SHALL 为「测试用例可视化插件」。

## ADDED Requirements（后端配合）

### Requirement: 登录响应体包含 token

`POST /api/platform/auth/login` 成功时，响应体 SHALL 包含 `token`（JWT）与 `user` 字段，同时 SHALL 继续下发 HttpOnly Cookie（向后兼容 Web 前端）。

#### Scenario: Web 前端登录不受影响

- **WHEN** Vue 前端调用登录接口
- **THEN** 浏览器收到 Cookie，登录态正常，行为与补 token 前一致

### Requirement: 平台服务跨域放行

platform-service SHALL 对 `chrome-extension://` 等跨源请求返回合法 CORS 响应头（允许 GET/POST/PUT/DELETE/OPTIONS，允许 Authorization/Content-Type 请求头），使 Chrome 扩展能够直连平台 API。

## MODIFIED Requirements

### Requirement: execute-service Midscene 依赖版本

execute-service 的 `@midscene/core` 与 `@midscene/web` SHALL 锁定为 `1.9.2`（修正 package.json 中无效的 `^1.12.1` 声明），与插件基底版本对齐。升级后以下能力 SHALL 保持正常：YAML 执行（runYaml）、NLP 执行（aiAct）、缓存优先与自愈（`cache: { id: caseId }`）、HTML 报告生成与合并（ReportMergingTool）。

#### Scenario: 缓存命中执行

- **WHEN** 同一用例第二次执行且页面未变化
- **THEN** 命中 `{caseId}.cache.yaml` 缓存，跳过 AI 规划推理，执行结果正常，报告正常生成
