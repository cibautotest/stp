# Proposal: NLP 智能识别操作类型 → 精确 YAML 生成

## 背景 (Why)

当前 NLP → YAML 的转换存在严重问题：

```
用户输入：打开 https://www.baidu.com，输入 兴业数金，点击搜索按钮，断言页面内有兴业数金

当前生成（前端 nlpToYaml）：
  - ai: 打开 https://www.baidu.com
  - ai: 输入 兴业数金，点击搜索按钮，断言页面内有兴业数金

当前生成（后端 YamlGeneratorService）：
  - ai: 打开 https://www.baidu.com，输入 兴业数金，点击搜索按钮，断言页面内有兴业数金
  - sleep: 3000
```

**所有步骤都被当成同一个 `ai:` action**，完全浪费了 Midscene 的 Instant Action 精确控制能力（`aiTap`、`aiInput`、`aiAssert`、`aiWaitFor` 等）。

## 目标 (What)

通过 **AI 模型调用**，将用户的一段 NLP 文本**智能拆解为多个 Midscene action**，每个 action 使用最合适的类型：

```
用户 NLP：打开 https://www.baidu.com，输入 兴业数金，点击搜索按钮，断言页面内有兴业数金

AI 模型输出（JSON）：
[
  { "type": "ai", "prompt": "打开 https://www.baidu.com" },
  { "type": "sleep", "value": "3000" },
  { "type": "aiInput", "prompt": "输入 兴业数金" },
  { "type": "aiTap", "prompt": "点击搜索按钮" },
  { "type": "aiAssert", "prompt": "断言页面内有兴业数金" }
]

最终 YAML（prompt 保持用户原文，不拆分 value/timeout）：
  - ai: 打开 https://www.baidu.com
  - sleep: 3000
  - aiInput: 输入 兴业数金
  - aiTap: 点击搜索按钮
  - aiAssert: 断言页面内有兴业数金
```

| 对比 | 当前 | 改造后 |
|------|------|--------|
| 操作识别 | 全部 `ai:` | 按语义自动选择 `ai`/`aiTap`/`aiInput`/`aiAssert`/`sleep`/`aiWaitFor` 等 |
| 原文保留 | 全部揉成一个 `ai:` | **prompt 保持用户原文，不拆分不改写** |
| 转化方式 | 纯字符串拆分 / 关键词匹配 | **调用 AI 模型**拆解步骤 + 匹配最合适的 action 类型 |

## 范围 (Scope)

### In Scope
- 后端新增 `NlpToActionsService`（调用 AI 模型将 NLP → action JSON）
- 后端重构 `YamlGeneratorService`（action JSON → YAML）
- 前端 `nlpToYaml()` 改为调用后端 API
- 前端 `FlowStepType` 扩展至 10+ 种 Midscene 标准 action
- 前端 YAML 编辑器适配新 action 类型

### Out of Scope
- 插件导出步骤的 NLP 拼接逻辑（插件仍发送原始 NLP，由后端转换）
- Midscene 执行引擎改造（`yaml-runner.ts` 已支持所有 action 类型）
- AI 模型配置变更（复用现有的 `ai_config` 表模型）

## 影响 (Impact)

- **修改文件**：`YamlGeneratorService.java`（`generateYaml()` 内部实现改造）
- **新增文件**：`model/ActionStep.java`
- **前端改动**：`FlowStepType` 扩展（YAML 编辑器适配）
- **API**：**零新增**，复用现有 `POST /cases/` → 执行时调 `generateYaml()`
- **成本**：每次执行时调用 1 次 AI 模型（轻量 prompt ~200 tokens）
- **降级**：AI 不可用时自动回退到整段 `ai:` action
