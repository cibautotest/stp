## Why

当前测试用例执行后，后端调用 `execute-service` 的异步接口后缺乏状态同步机制——执行结果需要依赖前端轮询或回调通知才能更新到数据库，导致用例列表状态滞后或不一致。需要通过后端定时任务主动轮询执行状态，确保用例状态及时同步。

## What Changes

- **新增**：执行记录模块（`ExecutionRecord` 实体），存储 `executionId` → `caseId` 映射关系
- **新增**：定时任务 `ExecutionStatusSyncService`，每 10 秒扫描 `RUNNING` 状态的用例，调用 `GET /execute/:id/status` 并更新状态
- **修改**：执行服务（`ExecutionService`、`CaseExecutionService`）在调用异步执行后，自动创建 `ExecutionRecord` 记录
- **新增**：状态枚举统一：`PENDING`（未执行）、`RUNNING`（执行中）、`SUCCESS`（成功）、`FAILED`（失败）、`UNKNOWN`（未知）
- **前端**：用例列表新增"最新报告"按钮，点击跳转 `htmlReportPath`
- **前端**：用例列表显示用例状态（未执行/执行中/成功/失败/未知）

## Capabilities

### New Capabilities

- `execution-record`: 执行记录管理 — 存储 executionId 与 caseId 的映射关系，支持按 executionId 查询 caseId
- `execution-status-sync`: 执行状态同步 — 后端定时任务轮询 execute-service 状态，更新 TestCase 状态并写入 Report 记录
- `test-case-status-display`: 测试用例状态展示 — 前端用例列表显示统一状态，新增报告链接入口

### Modified Capabilities

- `test-case`: 测试用例 — 新增 `status` 字段映射（对应统一的 `PENDING/RUNNING/SUCCESS/FAILED/UNKNOWN` 状态），`htmlReportPath` 已有

## Impact

- **后端**：`platform-service` 新增 `ExecutionRecord` 实体、`ExecutionRecordMapper`、`ExecutionStatusSyncService`；修改执行服务注入记录
- **数据库**：新增 `execution_record` 表
- **前端**：`frontend/src/views/cases/index.vue` 添加状态列和报告按钮；`frontend/src/stores/cases.ts` / `api/cases.ts` 支持状态字段
- **外部依赖**：`execute-service` 的 `GET /execute/:id/status` 接口（已有）
