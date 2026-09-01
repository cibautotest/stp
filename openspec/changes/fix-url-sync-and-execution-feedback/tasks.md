## 1. 前端：修复脚本生成后 URL 同步

- [x] 1.1 修改 `frontend/src/views/create/index.vue` 中的 `handleGenerateScript` 方法，在 `loadFromYaml` 之后显式从生成的 YAML 字符串中提取 URL 并设置到 `formData.url`
- [x] 1.2 验证场景：NLP 含 URL + 表单 URL 为空 → 表单 URL 应更新为 NLP 中的 URL
- [x] 1.3 验证场景：NLP 无 URL + 表单已填 URL → 表单 URL 保持不变
- [x] 1.4 验证场景：NLP 含 URL + 表单已有不同 URL → 表单 URL 保持不变（表单优先）

## 2. 前端：执行日志增加队列位置展示

- [x] 2.1 修改 `frontend/src/stores/cases.ts` 中 `runCaseAsync` 的 `onStatusUpdate` callback，增加 `queuePosition` 参数
- [x] 2.2 修改 `frontend/src/views/create/index.vue` 中 `handleExecuteAndSave` 的 callback，当 `status === 'queued'` 时展示队列位置（如"排队中（第 N 位），等待执行..."）
- [x] 2.3 验证：提交多个并发任务后，新任务的日志应显示正确的队列位置

## 3. 前端：失败信息精准化

- [x] 3.1 修改 `frontend/src/stores/cases.ts` 中 `runCaseAsync` 返回值结构，增加 `errorType` 和 `errorDetail` 字段
- [x] 3.2 修改轮询逻辑，当接收到 `status: 'failed'` 且 response 包含 `error` 字段时，将其作为 `errorDetail` 透传
- [x] 3.3 修改轮询超时分支，返回 `errorType: 'timeout'` 和明确的超时描述（轮询次数、总等待时间）
- [x] 3.4 修改网络异常分支（catch 块），返回 `errorType: 'network_error'` 而非 `null`
- [x] 3.5 修改 `frontend/src/views/create/index.vue` 中 `handleExecuteAndSave`，根据 `errorType` 显示对应的中文错误信息
- [x] 3.6 验证：模拟执行失败场景，确认日志显示具体错误原因而非泛化的"无法连接到执行服务"

## 4. execute-service：确认错误信息透传链路

- [x] 4.1 检查 `execute-service/src/core/orchestrator.ts` 的 `getStatus` 方法，确认 `error` 字段已包含在返回对象中
- [x] 4.2 检查 `execute-service/src/core/worker.ts` 的 catch 块，确认异常信息已正确写入 `record.error`
- [x] 4.3 验证：触发 Worker 执行异常（如无效 YAML），通过 GET `/execute/{id}/status` 确认返回包含 `error` 字段

## 5. 集成验证

- [x] 5.1 端到端验证 URL 同步：输入含 URL 的 NLP → 点击"生成脚本" → 确认编辑器 URL 字段已更新
- [x] 5.2 端到端验证执行日志：点击"执行&保存" → 确认日志显示队列位置 → 确认失败时显示具体错误信息
- [x] 5.3 端到端验证超时场景：阻塞所有 Worker → 提交新任务 → 确认超时后日志显示明确超时信息
