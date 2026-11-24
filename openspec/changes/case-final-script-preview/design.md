# Design: 用例最终下发脚本预览

## 核心决策

### 1. 预览 = 复用执行组装代码路径（不复制逻辑）

最终脚本的组装逻辑集中在 `CaseExecutionService.execute()`（stripLoginTask /
stripLegacyLoginPrefix / extractWebUrl / loginMethod 注入）。为保证"预览即执行所见"，
将 L83-162 的组装段抽取为：

```java
public ExecuteRequest buildExecuteRequest(TestCase testCase, String customYaml,
                                          String executionMode, List<String> warnings)
```

- `execute()` 传 `warnings=null`，构建后做硬校验（缺 yaml/nlp 抛 `IllegalArgumentException`，与原行为一致）；
- `previewFinalScript()` 传 warnings 列表收集告警，不抛错，缺失内容以告警形式返回。

**为何不落库存储**：最终脚本可由用例当前内容 + 登录方式确定性推导（无 AI 参与），
实时计算避免"存储的脚本与最新用例内容不一致"的陈旧问题，也无需迁移表结构。

### 2. 登录阶段脚本：平台侧移植执行机模板（仅展示用）

执行机 `yaml-runner.ts buildLoginYaml(lm)` 的拼装规则（优先 lm.yamlScript →
否则账号/密码 + stepsNlp 逐行 + 点击登录 + aiWaitFor；`[动态]` 前缀行 → `cacheable: false`）
在平台侧用 Java 移植为 `CaseExecutionService.buildLoginYamlPreview(...)`，仅用于展示。
两处模板必须保持同步，方法注释中双向标注（改执行机模板时同步改预览）。

### 3. 接口设计

`GET /api/platform/cases/{id}/final-script`（TestCaseController，JWT 鉴权）

响应 `FinalScriptPreview`：

| 字段 | 说明 |
|---|---|
| `executionMode` | 最终执行模式（请求参数 > 用例配置，规范化为 NLP/YAML） |
| `yamlScript` | 最终业务 YAML（YAML+登录时已剔除登录 task；SnakeYAML dump 后的文本） |
| `nlp` | 最终业务 NLP（已剥离登录前缀） |
| `targetUrl` | NLP 模式从 yamlScript 提取的 web.url（可为 null） |
| `headless` / `timeout` | 下发默认值（headless 默认 true，timeout 600000） |
| `loginMethod` | 下发的登录方式负载（复用 `ExecuteRequest.LoginMethodPayload`） |
| `loginYamlPreview` | 登录阶段 YAML 预览（免登录/none 为 null） |
| `warnings` | 缺失/异常告警（如"yaml脚本未生成，执行时将被拒绝"） |

用例不存在返回 404。注意：预览基于**已保存**的用例内容，编辑器未保存改动不反映。

### 4. 前端交互

详情页页头"查看缓存"旁新增"最终脚本"按钮 → 弹窗展示：
顶部 el-descriptions（执行模式/目标网址/登录方式）+ warnings 告警条 +
按模式展示业务脚本（YAML pre 块 / NLP pre 块）+ 登录阶段脚本 pre 块，
每块提供复制按钮（navigator.clipboard）。

## 涉及文件

| 层 | 文件 | 改动 |
|---|---|---|
| 后端 | `model/FinalScriptPreview.java` | 新增 DTO |
| 后端 | `service/CaseExecutionService.java` | 抽取 `buildExecuteRequest`；新增 `previewFinalScript`、`buildLoginYamlPreview` |
| 后端 | `controller/TestCaseController.java` | 新增 `GET /{id}/final-script` |
| 后端 | `test/.../CaseExecutionServiceTest.java` | 新增预览与登录 YAML 模板单测 |
| 前端 | `api/cases.ts` | 新增 `getFinalScript` + 类型 |
| 前端 | `views/detail/index.vue` | 新增按钮 + 预览弹窗 |

## 风险与对策

- **模板双份维护漂移**：预览模板与执行机 `buildLoginYaml` 需人工同步 → 双方注释互相引用 + 单测锚定模板输出格式；
- **密码展示**：登录 YAML 预览含明文密码（与实际下发一致，平台登录方式列表 API 本就返回 password 字段，未扩大暴露面）；
- **SnakeYAML dump 格式变化**：预览如实展示 dump 后文本（这正是执行机实际收到的），提示文案说明格式可能与编辑器中的原始 YAML 不同。
