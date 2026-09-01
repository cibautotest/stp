## Why

用户在"创建测试"页面遇到两个体验问题：(1) 填写 NLP 指令点击"生成脚本"后，脚本编辑器的目标 URL 字段未同步更新，用户需手动复制 URL；(2) 点击"执行&保存"后，执行日志在任务队列积压时仅重复显示"任务已入队，等待执行..."（每 3 秒一次，持续到超时），最终以泛化的"无法连接到执行服务"报错，用户无法得知真实失败原因或队列位置。这两个问题严重影响了测试创建的效率和可调试性。

## What Changes

- **脚本生成时 URL 自动同步**：NLP 中包含的 URL 或表单中已填写的 URL 在生成脚本后自动反映到编辑器的目标 URL 字段
- **执行日志增加队列位置信息**：轮询执行状态时，前端展示当前队列位置（如"排队中（第 2 位）"），让用户了解等待进度
- **失败信息精准化**：区分"提交失败"、"执行超时"、"Worker 异常"等场景，替代泛化的"无法连接到执行服务"
- **轮询状态细化**：在 `queued` 状态时获取并展示队列位置；在超时时明确告知轮询次数和超时时间
- **execute-service 错误信息透传**：Worker 执行失败时，将具体错误信息（如浏览器引擎缺失、YAML 校验错误等）通过状态查询 API 返回给前端

## Capabilities

### New Capabilities
- `execution-feedback`: 执行日志反馈增强，包括队列位置展示、精准错误信息透传、超时详情

### Modified Capabilities
- `yaml-script-generation`: 生成脚本时同步更新目标 URL 字段（行为修正，不影响 API 契约）

## Impact

- **前端**：`frontend/src/views/create/index.vue`（执行日志逻辑）、`frontend/src/composables/useYamlEditor.ts`（URL 同步）、`frontend/src/stores/cases.ts`（轮询状态处理）
- **execute-service**：`execute-service/src/core/worker.ts`（错误信息记录）、`execute-service/src/core/orchestrator.ts`（getStatus 返回队列位置和错误详情）
- **无 API 契约变更**：所有改动在现有接口数据结构和前端展示层
