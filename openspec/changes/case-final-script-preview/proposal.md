# Proposal: 用例详情页预览最终下发执行机的 Midscene 脚本

## 背景 (Why)

用例详情页当前展示的 YAML/NLP 是**用例原始存储内容**（`test_cases.yaml_flow / nlp`），
而后端在执行时会对脚本做一系列转换后才下发执行机，用户在前端**看不到最终形态**：

1. YAML 模式 + 绑定登录方式时：剔除 YAML 中 name 以「登录」开头的 task（`stripLoginTask`，SnakeYAML 重新 dump 后文本格式也会变化）；
2. NLP 模式时：剥离存量用例残留的登录前缀（`stripLegacyLoginPrefix`），并从 YAML 中提取 `web.url` 作为 `targetUrl` 下发；
3. 登录方式以独立 `loginMethod` 负载下发，登录 YAML 由执行机端 `buildLoginYaml` 模板拼装（账号/密码/补充步骤/[动态]标记）。

排障时用户经常困惑："我写的脚本"和"实际执行的脚本"不一致（登录 task 去哪了、NLP 第一行为什么没执行、web.url 为什么变成了 targetUrl）。

## 目标 (What)

在用例详情页新增"最终脚本"入口：调用新的预览 API，展示后端组装完成、
即将通过 `POST /execute/async` 下发执行机的最终 Midscene 脚本，包括：

- 执行模式（NLP/YAML）与目标网址（NLP 模式 targetUrl）；
- 最终业务脚本：YAML 模式 = 剔除登录 task 后的 yamlScript；NLP 模式 = 剥离登录前缀后的 nlp；
- 登录阶段脚本预览：按执行机 `buildLoginYaml` 模板规则拼装的登录 YAML（账号/密码输入、补充步骤、[动态] → cacheable: false、aiWaitFor 登录完成）；
- 缺失内容时给出告警（如 YAML 模式 yamlFlow 未生成，执行时会被拒绝）。

## 范围 (Scope)

### In Scope
- 后端 `CaseExecutionService`：抽取组装逻辑为 `buildExecuteRequest`（执行与预览共用一条代码路径，保证预览=执行所见）；
- 后端新增 `FinalScriptPreview` 模型 + `GET /api/platform/cases/{id}/final-script` 预览接口；
- 后端移植执行机 `buildLoginYaml` 模板为 `buildLoginYamlPreview`（仅用于展示）；
- 前端 `api/cases.ts` 新增 `getFinalScript`；详情页新增"最终脚本"按钮 + 预览弹窗。

### Out of Scope
- 执行机 execute-service 改造（登录 YAML 拼装逻辑仍在执行机执行，本次仅在前端展示等价预览）；
- 执行记录落库存储最终脚本（ExecutionRecord 不加字段，预览按当前用例内容实时计算）；
- 免鉴权（接口走既有 JWT Cookie 鉴权）。

## 影响 (Impact)

- **修改文件**：`CaseExecutionService.java`（抽取 `buildExecuteRequest`，行为不变）、`TestCaseController.java`（新端点）、`api/cases.ts`、`views/detail/index.vue`；
- **新增文件**：`model/FinalScriptPreview.java`、单测扩展 `CaseExecutionServiceTest.java`；
- **API**：新增 1 个只读查询接口，无破坏性变更；
- **行为差异说明**：NLP 模式校验从"用例原始 nlp 非空"改为"剥离登录前缀后非空"——若存量用例 nlp 仅含登录前缀，执行时将明确报错（原为下发空步骤），视为缺陷修复。
