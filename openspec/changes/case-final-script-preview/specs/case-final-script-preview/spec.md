## ADDED Requirements

### Requirement: 最终下发脚本预览接口

系统 SHALL 提供只读接口 `GET /api/platform/cases/{id}/final-script`，返回该用例执行时后端组装并下发执行机的最终 Midscene 脚本形态。

#### Scenario: YAML 模式且绑定登录方式
- **WHEN** 用例 executionMode 为 YAML 且绑定了非 none 登录方式
- **THEN** 响应 `yamlScript` SHALL 为剔除「登录」task 后的最终 YAML
- **AND** `loginMethod` SHALL 为下发的登录方式负载
- **AND** `loginYamlPreview` SHALL 为按执行机 buildLoginYaml 模板规则拼装的登录 YAML

#### Scenario: NLP 模式
- **WHEN** 用例 executionMode 为 NLP
- **THEN** 响应 `nlp` SHALL 为剥离登录前缀后的业务步骤
- **AND** 当 YAML 中含 `web.url` 时 `targetUrl` SHALL 为提取出的目标网址

#### Scenario: 内容缺失不阻断预览
- **WHEN** YAML 模式 yamlFlow 未生成或 NLP 模式 nlp 为空
- **THEN** 接口 SHALL 正常返回 200，并在 `warnings` 中说明缺失项（执行时会被拒绝）

#### Scenario: 用例不存在
- **WHEN** caseId 不存在
- **THEN** 接口 SHALL 返回 404

### Requirement: 预览与执行共用组装路径

最终脚本预览 SHALL 复用执行链路的 `buildExecuteRequest` 组装逻辑（stripLoginTask / stripLegacyLoginPrefix / extractWebUrl / loginMethod 注入），确保预览结果与实际下发执行机的 payload 一致；登录阶段 YAML 预览模板 SHALL 与执行机 `yaml-runner.ts buildLoginYaml` 保持同步。

### Requirement: 前端详情页最终脚本展示

用例详情页 SHALL 提供"最终脚本"入口，弹窗展示：执行模式、目标网址、登录方式、业务脚本（YAML/NLP 按模式）、登录阶段脚本预览、缺失告警，并提示预览基于已保存的用例内容。
