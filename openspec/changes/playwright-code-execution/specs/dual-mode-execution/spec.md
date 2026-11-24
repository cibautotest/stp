# 能力规格：playwright-code-execution

## ADDED Requirements

### Requirement: 录制脚本自动生成

系统 SHALL 在用例以 NLP/YAML 模式执行且业务阶段成功后，从 Midscene 执行产物（plan 缓存步骤流、locate 缓存 XPath、onDumpUpdate 元素信息）自动翻译生成 Playwright TypeScript 脚本，并上传至平台关联该用例。

#### Scenario: NLP 执行成功后生成录制脚本

- **WHEN** 用例以 NLP 模式执行且业务阶段状态为 SUCCESS
- **THEN** 执行引擎生成对应 TS 脚本并调用 `PUT /internal/scripts/{caseId}` 上传
- **AND** 平台将该用例 `script_status` 更新为 `RECORDED`，记录 `script_source_execution_id` 与 `script_recorded_at`

#### Scenario: 失败执行不录制

- **WHEN** 用例以 NLP/YAML 模式执行且业务阶段失败或取消
- **THEN** 不生成、不上传录制脚本

#### Scenario: 录制步骤优先使用语义化 selector

- **WHEN** 执行期间某步命中元素可反查（该步后页面状态仍持有该元素）
- **THEN** 生成的脚本该步骤 selector 候选链以语义化定位开头（如 `role=button[name="登 录"]`、`text="触发故障"`、`#id`、`[data-testid=...]`），绝对 XPath 作为兜底候选排在后位；连续的"点击聚焦+输入"步骤对合并为单条 fill 语句

#### Scenario: 不可翻译步骤降级为 @ai 步骤

- **WHEN** 步骤为复杂语义断言、aiWaitFor、`[动态]` 标记步骤或 iframe 内元素
- **THEN** 生成的脚本中该步骤以 `stp.ai(page, '原语义注释')` 形式存在，不产出确定性代码

#### Scenario: 登录阶段不录制

- **WHEN** 执行包含登录阶段（loginMethod.type != 'none'）
- **THEN** 录制范围仅限业务阶段；生成的脚本不含任何登录凭据

### Requirement: CODE 执行模式

系统 SHALL 支持 `execution_mode = CODE`：直接执行用例关联的录制 TS 脚本（注入受限 `stp` 上下文），无 LLM 推理调用，并完整保留流量染色（sw8）、报文采集回传（Kafka）与报告产出能力。

#### Scenario: CODE 模式正常执行

- **WHEN** 用户对 `script_status = RECORDED` 的用例以 CODE 模式执行
- **THEN** 执行引擎先完成登录阶段（复用登录方式与登录缓存），随后注入执行录制脚本，业务步骤不调用 LLM
- **AND** 生成轻量 HTML 报告（步骤表、耗时、结果）并经现有报告通道上传
- **AND** NetworkObserver 挂载 context 级染色与报文采集，行为与 NLP/YAML 模式一致

#### Scenario: 脚本缺失或过期时拒绝 CODE 执行

- **WHEN** 用例 `script_status` 为 `NONE` 或 `STALE` 且请求以 CODE 模式执行
- **THEN** 平台拒绝下发并返回明确错误（提示需先以 NLP/YAML 执行成功录制，或 NLP 已变更需重新录制）

### Requirement: Midscene AI 兜底

CODE 执行中元素定位失败（selector 链全部超时/未命中）时，系统 SHALL 以该步骤的语义注释为 prompt 调用 Midscene 在同一 page 上重试该步，兜底命中结果回写用例 locate 缓存，且在报告中标注兜底事件。

#### Scenario: selector 失败触发 AI 兜底

- **WHEN** CODE 执行中某步骤 selector 链全部定位失败
- **THEN** 以步骤语义注释为 prompt 调用 Midscene 对应动作（如 aiTap）在同一 page 重试
- **AND** 兜底成功则业务流程继续，该步骤在报告与步骤结果中标注 `AI兜底`，新命中定位回写 locate 缓存并随执行回传平台
- **AND** 兜底失败则该步骤判定失败，按失败报告路径收尾

#### Scenario: @ai 步骤主动走 Midscene

- **WHEN** CODE 执行遇到 `stp.ai(...)` 步骤
- **THEN** 直接调用 Midscene 执行该步骤（非失败触发），结果同样记录 AI 标记

### Requirement: 脚本内部上传接口

平台 SHALL 提供内部接口 `PUT /api/platform/internal/scripts/{caseId}` 接收执行引擎上传的录制脚本，防护措施与现有内部接口一致（白名单 + X-Report-Upload-Token + 大小上限）。

#### Scenario: 正常上传更新脚本

- **WHEN** 携带合法 token 上传脚本且用例 `script_status != 'STALE'`
- **THEN** 平台写入 script 内容并更新状态元数据为 RECORDED

#### Scenario: STALE 竞态保护（区分正常重录与真竞态）

- **WHEN** 上传到达时用例 `script_status = 'STALE'`，且执行下发时记录的内容哈希（`execution_record.dispatched_content_hash`）与用例当前内容一致（STALE 发生在执行下发之前，属用户改完 NLP 后的正常重录）
- **THEN** 平台放行覆盖，脚本更新并置 `RECORDED`

- **WHEN** 上传到达时 `script_status = 'STALE'` 且当前内容哈希与下发时不一致（执行期间 NLP/YAML 又被修改），或无法判定（无 executionId / 记录缺失 / 旧记录无哈希）
- **THEN** 平台拒绝覆盖（409），保留 STALE 状态

## MODIFIED Requirements

### Requirement: 用例执行模式枚举

`execution_mode` 合法值 SHALL 从 `NLP|YAML` 扩展为 `NLP|YAML|CODE`，全链路（Java 校验、zod/OpenAPI、前端类型、worker 分发）同步生效。

#### Scenario: CODE 模式请求透传到执行引擎

- **WHEN** 前端/接口以 `executionMode=CODE` 且携带非空 `script` 发起执行
- **THEN** 请求经 ExecuteRequest → QueueTask → worker 三层透传，worker 分发至 CODE runner

### Requirement: 用例编辑导致录制脚本失效

用户修改用例 `nlp` 或 `yaml_flow` 时，系统 SHALL 将 `script_status` 置为 `STALE`（脚本内容保留供对照）。

#### Scenario: 修改 NLP 使录制脚本过期

- **WHEN** 用户编辑用例并实际变更了 nlp 或 yaml_flow 内容
- **THEN** 更新成功后 `script_status = 'STALE'`，详情页展示"已过期，需重新录制"提示

### Requirement: 用例详情展示录制脚本

用例详情页 SHALL 展示录制 TS 脚本（语法高亮、只读、可复制），标注 `@ai` 步骤与脚本状态（NONE/RECORDED/STALE），并在脚本有效时提供 CODE 执行模式切换。

#### Scenario: 查看录制脚本

- **WHEN** 用户打开含录制脚本的用例详情页
- **THEN** 可见 TS 语法高亮的脚本内容、@ai 步骤标记、录制来源执行 ID 与录制时间

#### Scenario: STALE 脚本的 CODE 选项禁用

- **WHEN** 脚本状态为 STALE 或 NONE
- **THEN** CODE 执行选项禁用并展示原因 tooltip
