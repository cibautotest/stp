# Design: NLP 智能识别操作类型 → 精确 YAML 生成

## 1. 整体架构

```
┌──────────────┐     POST /api/platform/nlp/to-actions     ┌────────────────────┐
│  前端/插件    │──────────────────────────────────────────▶│  Platform Service  │
│  NLP 文本     │    Body: { nlp, url? }                   │                    │
│              │◀──────────────────────────────────────────│  NlpToActionsService│
│              │    Response: [{type, prompt?, value?}]     │        ↓           │
└──────────────┘                                           │  调用 AI 模型       │
                                                           │        ↓           │
                                                           │  YamlGeneratorService│
                                                           │  action JSON → YAML │
                                                           └────────────────────┘
```

**核心思路**：不 hard code 关键词匹配，而是把 NLP 文本 + Midscene action schema 发给 AI 模型，让模型自己判断每个步骤该用什么 action 类型。

## 2. AI Prompt 设计

### 2.1 System Prompt

```
You are a test automation expert. Convert a user's natural language test description 
into a list of Midscene.js actions.

Available action types:
- ai:        Generic AI interaction (fallback when no specific type fits)
- aiTap:     Click/tap, e.g. "点击搜索按钮" → {"type":"aiTap","prompt":"搜索按钮"}
- aiInput:   Type text. MUST separate prompt (element) and value (text).
             e.g. "输入 Headphones" → {"type":"aiInput","prompt":"搜索框","value":"Headphones"}
- aiHover:   Hover over element
- aiScroll:  Scroll page
- aiAssert:  Assert/verify/check condition, e.g. "断言有结果" → {"type":"aiAssert","prompt":"有结果"}
- aiWaitFor: Wait until condition met
- sleep:     Wait N ms, e.g. "等待3秒" → {"type":"sleep","value":"3000"}
- aiQuery:   Data extraction

RULES:
1. Split text into individual steps by commas/periods/semantic breaks
2. For aiInput: extract element description (prompt) and input text (value) separately
3. For other types: prompt = the action description only (without "点击"/"断言" prefix)
4. After opening a URL, insert {"type":"sleep","value":"3000"}
5. Output ONLY a JSON array, no explanation

Example input: 打开百度，输入Headphones，点击搜索按钮，断言有结果

Example output:
[
  {"type":"ai","prompt":"打开百度"},
  {"type":"sleep","value":"3000"},
  {"type":"aiInput","prompt":"搜索框","value":"Headphones"},
  {"type":"aiTap","prompt":"搜索按钮"},
  {"type":"aiAssert","prompt":"有结果"}
]
```

### 2.2 输入示例

```
User NLP: 打开 https://www.baidu.com，输入 兴业数金，点击搜索按钮，断言页面内有兴业数金
```

### 2.3 期望输出

```json
[
  {"type": "ai", "prompt": "打开 https://www.baidu.com"},
  {"type": "aiInput", "prompt": "搜索输入框", "value": "兴业数金"},
  {"type": "aiTap", "prompt": "搜索按钮"},
  {"type": "sleep", "value": "3000"},
  {"type": "aiAssert", "prompt": "页面内包含兴业数金相关内容"}
]
```

## 3. 后端设计（零新增 API，只改造现有 Service）

### 3.1 改动范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `model/ActionStep.java` | **新增** | 数据模型 |
| `YamlGeneratorService.java` | **改造** | `generateYaml()` 内部改为调 AI → action JSON → YAML |
| `AiConfigService.java` | **不改** | 已有 `getCurrentConfig()` |
| **无新增 Controller** | — | 复用现有用例创建流程 |

### 3.2 调用链路（不新增端点）

```
前端 nlpToYaml() ──纯前端──▶ 不再调后端新 API
后端 POST /cases/ 创建用例时:
  TestCaseController.create()
    → TestCaseService 保存 nlp 到数据库
    → 执行时 CaseExecutionService.execute()
      → YamlGeneratorService.generateYaml(nlp)  ← 唯一改动点
        → 内部调 AI 模型 → action JSON → YAML
```

### 3.3 ActionStep 模型

```java
// model/ActionStep.java
public class ActionStep {
    private String type;   // ai | aiTap | aiInput | aiAssert | sleep | aiWaitFor | aiScroll | aiHover | aiQuery
    private String prompt; // 用户原文，不做任何改写
}
```

### 3.4 YamlGeneratorService 改造

保持现有 `@Service` + `generateYaml(String nlp)` 签名不变，只改内部实现：

```java
@Service
public class YamlGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(YamlGeneratorService.class);

    @Resource
    private AiConfigService aiConfigService;

    /**
     * 从 NLP 文本生成 Midscene YAML 任务流
     * 改造后：调用 AI 模型智能拆解步骤 + 匹配 action 类型
     */
    public String generateYaml(String nlp) {
        if (nlp == null || nlp.isBlank()) {
            return "tasks:\n  - name: default\n    flow:\n      - ai: ''\n";
        }

        // 1. 调用 AI 模型将 NLP → List<ActionStep>
        List<ActionStep> steps = nlpToActions(nlp);

        // 2. ActionStep 列表 → YAML 字符串
        return actionsToYaml(steps);
    }

    private List<ActionStep> nlpToActions(String nlp) {
        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null) {
            log.warn("[YamlGen] AI config not set, falling back to single ai: action");
            return fallbackActions(nlp);
        }

        try {
            // 构建 system prompt（见 2.1）+ 用户 NLP
            // 调用 AI API: POST {baseUrl}/chat/completions
            //   使用 Hutool HttpUtil.post()
            // 解析 JSON → List<ActionStep>
            // 返回
        } catch (Exception e) {
            log.error("[YamlGen] AI call failed, falling back", e);
            return fallbackActions(nlp);  // 降级：整段当 ai:
        }
    }

    // 降级：整段 NLP 作为一个 ai: action
    private List<ActionStep> fallbackActions(String nlp) {
        ActionStep step = new ActionStep();
        step.setType("ai");
        step.setPrompt(nlp);
        return Collections.singletonList(step);
    }

    private String actionsToYaml(List<ActionStep> steps) {
        StringBuilder yaml = new StringBuilder();
        yaml.append("tasks:\n");
        yaml.append("  - name: AI 测试\n");
        yaml.append("    flow:\n");
        for (ActionStep s : steps) {
            yaml.append("      - ").append(s.getType()).append(": ").append(s.getPrompt()).append("\n");
        }
        return yaml.toString();
    }

    // 保留旧方法: extractUrl(), validate(), escapeYaml()
}
```

## 4. 前端设计

### 4.1 FlowStepType 扩展

```typescript
export type FlowStepType =
  | 'ai' | 'aiAct'
  | 'aiTap' | 'aiInput' | 'aiHover' | 'aiKeyboardPress' | 'aiScroll'
  | 'aiAssert' | 'aiWaitFor' | 'aiQuery'
  | 'sleep' | 'javascript' | 'recordToReport'
```

### 4.2 nlpToYaml 保留前端实现，不调后端

前端 `nlpToYaml()` 保持纯前端逻辑（不调后端 API）——因为 YAML 是执行时才由后端 `YamlGeneratorService` 生成的，前端只是编辑预览。

前端改造仅限于：
- `FlowStepType` 扩展至 10+ 种 Midscene 标准 action
- `useYamlEditor.ts` 支持各 action 类型的前端编辑

## 5. 关键设计决策

### 5.1 AI 模型调用 vs 本地规则引擎

**决策：AI 模型调用**

- 只做两件事：**拆解步骤** + **匹配 action 类型**
- prompt 必须是用户原文，不做任何改写
- 不拆解 "输入兴业数金" 为 prompt="输入框" + value="兴业数金"——原文照搬

### 5.2 调用哪个 AI 模型

**决策：复用 ai_config 中配置的模型**

- 与 Midscene 执行共用同一套 AI 配置（`ai_config` 表）
- 用户可自己选择模型（OpenAI / Claude / 千问）
- Prompt 只需 ~200 tokens + 用户 NLP，成本极低

### 5.3 前端渲染方式

**决策：先调后端 → 拿到 action JSON → 前端渲染到 YAML 编辑器**

- 用户可以在 YAML 编辑器中微调
- 保留手动编辑能力

## 6. 风险与边界

| 风险 | 缓解 |
|------|------|
| AI 返回非 JSON | try-catch + retry + 降级到旧规则引擎 |
| 模型不可用 | 降级：旧的关键词匹配作为 fallback |
| 额外 API 调用延迟 | 前端 loading 状态 + 轻量 prompt（响应 < 2s） |
| AI 理解偏差 | YAML 编辑器保留，用户可手动修正 |
| 前端 action 类型不完整 | FlowStepType 一次性扩展至 Midscene 全量类型 |
