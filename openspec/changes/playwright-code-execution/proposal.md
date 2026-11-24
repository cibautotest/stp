# 变更提案：playwright-code-execution（Playwright 代码执行模式 + Midscene 录制与 AI 兜底）

## 为什么改

当前用例执行只有 NLP/YAML 两种 Midscene 驱动模式：即使元素定位缓存命中，每步仍要经过 Midscene 框架开销（截图、dump、报告生成），且强依赖 LLM 服务可用性。对回归测试、日常巡检等**批量重复执行**场景，同一用例的步骤序列与元素定位在首次成功执行后已经完全确定，重复执行没有理由再付出视觉识别成本——这正违背项目"单个 case 微小提升，批量场景大幅提升"的初衷。

本变更将 Midscene 的角色从"执行者"重构为"**录制器 + 兜底者**"：

1. 自然语言执行成功后，自动录制出可独立重放的 **Playwright TypeScript 脚本**；
2. 用例可切换为 **CODE 模式**直接跑该脚本（无 LLM 调用、无 Midscene 框架开销）；
3. CODE 执行中遇到元素定位失败等异常，由 Midscene AI 以原步骤语义**实时兜底**，保证业务流程不中断；
4. 保留接口流量染色（sw8）、报文录制回传（Kafka）全链路可观测能力。

## 改什么

### 影响范围（四端联动）

| 端 | 改动 |
|---|---|
| execute-service | 新增录制器（NLP/YAML 执行后翻译生成 TS 脚本）、CODE 模式 runner（包装函数注入执行 + Midscene 兜底桥）、脚本上传接口调用 |
| backend/platform-service | `execution_mode` 扩枚举 `CODE`；`test_cases` 启用预留的 `script` 字段并新增脚本状态元数据；新增内部脚本接收接口；`ExecuteRequest` 透传 `script`；NLP/YAML 变更触发脚本失效 |
| frontend | 用例详情页新增录制脚本展示（CodeMirror + TS 语法高亮、AI 兜底标记渲染）与执行模式切换；创建页不暴露 CODE |
| 插件 | 无改动（插件导出的是 NLP 步骤，由平台执行时录制，天然兼容） |

### 核心行为变更

1. **双模执行语义**：`execution_mode` 从 `NLP|YAML` 扩展为 `NLP|YAML|CODE`；CODE 模式仅在用例已有有效录制脚本（`script_status = RECORDED`）时可选。
2. **录制**：NLP/YAML 模式执行且业务阶段成功后，由录制器从 Midscene 产物（plan cache 步骤流 × locate cache XPath × onDumpUpdate 实时元素信息）机械翻译生成 TS 脚本，执行完成后上传平台并关联用例。
3. **登录阶段不录制**：CODE 执行仍先走现有登录阶段（独立缓存 `login_{methodId}`），登录后切入代码 runner，保持"登录方式资产化"语义不被破坏。
4. **AI 兜底**：生成脚本每步保留原自然语言语义注释并经由包装函数（`stp.click / stp.fill / ...`）执行；步骤失败时以语义注释为 prompt 调用 Midscene（attach 同一 page、共用同一用例缓存）重试该步，兜底结果回写 locate 缓存。
5. **失效语义**：用例 `nlp / yaml_flow` 变更时录制脚本置 `STALE`，详情页徽标提示需重新录制。

## 影响与风险

- **不做的事（明确出界）**：录制脚本的用户编辑/手写 CODE 用例（涉及远程代码执行信任边界，列为后续独立变更）；兜底成功后的脚本自动回写（self-healing，v2 决策点）；插件端改动。
- **主要风险**：selector 脆弱性（绝对 XPath 兜底 + selector 升级策略缓解）、复杂断言翻译失真（`@ai` 步骤兜底缓解）、录制脚本体积（LONGTEXT + 上传上限控制）。

## 关联文档

- `design.md` — 技术方案：录制器数据源、动作映射表、CODE runner 架构、兜底桥、接口与数据模型变更
- `tasks.md` — 实施任务清单
- `specs/` — 能力规格（ADDED/MODIFIED 需求）
- `verification/test-cases.md` — 验收用例清单
