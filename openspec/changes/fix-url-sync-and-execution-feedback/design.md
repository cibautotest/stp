## Context

当前"创建测试"页面存在两个体验缺陷，涉及前端 Vue 组件和 execute-service 的状态查询链路。

**当前数据流（执行链路）**：

```
用户点击"执行&保存"
  → create/index.vue: handleExecuteAndSave()
    → yamlEditorRef.syncFormToYaml()   // 表单→YAML 文本
    → syncNlpToYaml()                   // NLP→YAML（调用 AI）
    → caseStore.runCaseAsync(data, callback)
      → POST /api/platform/execute/create-and-execute  → platform-service
        → 创建 TestCase (MySQL)
        → POST /execute/async  → execute-service
          → orchestrator.executeAsync()
            → YAML 校验 → 创建 ExecutionRecord (内存) → 入队 MemoryQueue
            → 返回 { executionId, status: 'queued' }
        → 返回 { caseId, executionId }
      → 前端轮询 GET /api/execute/{id}/status（每3秒，最多100次）
        → orchestrator.getStatus() → 从 ExecutionStore (内存Map) 读取
        → 返回 { status, queuePosition, error, reportUrl }
      → callback 触发 addLog()
```

**当前问题点**：
1. `nlpToYaml()` 生成的 YAML 文本包含 URL，但 `loadFromYaml()` → `syncYamlToForm()` 解析后 `formData.url` 更新依赖于 YAML 结构正确性
2. 前端轮询拿到 `queued` 状态时只显示"任务已入队，等待执行..."，不展示 `queuePosition`
3. 轮询超时后 `runCaseAsync` 返回 `null`，前端 `handleExecuteAndSave` 进入 `if (!result)` 分支，显示"无法连接到执行服务"——这个错误信息完全误导用户
4. Worker 执行失败时 `worker.ts` 将错误信息存入 `record.error`，但 `orchestrator.getStatus()` 没有返回 `error` 字段

## Goals / Non-Goals

**Goals:**
- 修复脚本生成后 URL 字段同步问题：确保 NLP 中的 URL 或表单 URL 正确回填到编辑器
- 执行日志展示队列位置：让用户知道还需要等多久
- 精准的错误信息：区分不同失败场景，显示真实错误原因
- execute-service 状态 API 返回错误详情：透传 Worker 异常信息

**Non-Goals:**
- 不改变现有 API 契约（不新增字段，仅在已有字段上增强内容）
- 不引入 WebSocket/SSE 实时推送（保持轮询机制）
- 不修改 platform-service 后端逻辑
- 不改变 WorkerPool 并发模型

## Decisions

### Decision 1：URL 同步修复 — 在 `nlpToYaml` 返回后显式设置 formData.url

**方案**：在 `handleGenerateScript` 中，`loadFromYaml` 之后额外调用一次 `setFormUrl()`，从生成的 YAML 中正则提取 URL 直接设置到 formData。

**替代方案考虑**：
- 方案 A：在 `syncYamlToForm` 中修复解析逻辑 → 被否决，因为 YAML 解析本身逻辑正确，问题可能出在 `loadFromYaml` 的时序（yamlContent 更新和 syncYamlToForm 的调用顺序）
- 方案 B：在 `nlpToYaml` 返回 URL 作为元数据 → 过度设计，引入额外返回值

**选择**：采用显式设置方案，在 `loadFromYaml` 之后直接用正则从 YAML 字符串提取 URL 设置 formData。这样最直接、最可靠。

### Decision 2：执行日志增强 — 在轮询 callback 中利用 queuePosition

**方案**：在 `runCaseAsync` 的 `onStatusUpdate` callback 中增加 `queuePosition` 参数，前端 `handleExecuteAndSave` 根据该参数展示"排队中（第 N 位）"。

execute-service 的 `orchestrator.getStatus()` 已经返回 `queuePosition` 字段，前端只需消费它。

### Decision 3：失败信息精准化 — 重构 runCaseAsync 返回值

**方案**：将 `runCaseAsync` 返回值从 `{ caseId, executionId, success } | null` 扩展为包含 `errorType` 和 `errorDetail` 的结构：

```
{ caseId, executionId, success, errorType, errorDetail }
```

errorType 枚举：
- `submit_failed` — 用例已保存但执行提交失败
- `timeout` — 轮询超时（100次×3秒=300秒）
- `execution_failed` — Worker 执行失败
- `network_error` — 网络异常（原 `null` 场景）

前端 `handleExecuteAndSave` 根据 errorType 展示对应的中文错误信息。

### Decision 4：Worker 错误透传 — getStatus 返回 error 字段

**方案**：`orchestrator.getStatus()` 已经构造返回对象时包含了 `error: record.error`（line 129），确认此字段正常工作即可。前端轮询时读取 `statusRes.error`，在 `failed` 状态时展示。

**当前代码验证**：`orchestrator.ts:110-132` 中 `getStatus` 返回对象已包含 `error: record.error`，`worker.ts:85` 在 catch 块中设置了 `updated.error = message`。链路已通，前端只需消费。

## Risks / Trade-offs

- **[风险] URL 同步可能覆盖用户手动修改的 URL**：如果用户在生成脚本后手动修改了 URL，再次点击"生成脚本"会覆盖 → **缓解**：这是预期行为，"生成脚本"本身就是重新生成，覆盖是合理的
- **[风险] queuePosition 在 execute-service 重启后丢失**：MemoryQueue 重启后队列清空 → **缓解**：当前 scope 不处理，属于 execute-service 高可用问题
- **[风险] 轮询 300 秒超时对长时间测试不够**：某些复杂测试可能需要更长时间 → **缓解**：暂不修改超时阈值，属于后续优化
