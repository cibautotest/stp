## Why

测试计划（TestPlan）模块已支持计划的 CRUD 和用例管理，但用户无法以计划为单位触发执行。目前批量执行入口仅在用例列表页通过手动勾选触发，与测试计划完全割裂。用户需要"执行整个测试计划"的能力——按计划中用例的排序顺序串行执行所有用例，并记录执行历史。

## What Changes

- **新增计划执行入口**：测试计划列表页每个计划卡片右侧增加"执行"按钮
- **按 sort_order 顺序串行执行**：计划内用例按 `sort_order` 升序逐个提交执行，前一个用例完成后才执行下一个
- **复用批量执行进度弹窗**：执行开始后弹出 BatchProgressDialog 展示进度，所有 CASE 共享同一 batchId
- **记录计划执行历史**：test_plans 表新增 `last_executed_at`（上次执行时间）、`last_execution_result`（上次执行结果：PASSED / FAILED / N_FAILED）、`last_batch_id`（关联批次ID）
- **后端新端点** `POST /api/platform/plans/{id}/execute`：异步触发整个计划执行，立即返回 batchId

## Capabilities

### New Capabilities
- `plan-execution`: 以计划为单位触发执行，按 sort_order 串行提交用例，记录执行历史，复用批量执行进度展示

### Modified Capabilities
<!-- No existing specs to modify -->

## Impact

| 层级 | 影响 |
|------|------|
| **数据库** | `test_plans` 表新增 3 列：`last_executed_at`、`last_execution_result`、`last_batch_id` |
| **后端** | 新增 `TestPlanController.executePlan()` 端点；新增 `PlanExecutionService` 负责串行调度；修改 `TestPlan` Entity |
| **Execute Service** | 无需修改（复用现有单个执行 + 批量进度查询） |
| **前端** | `plans/index.vue` 计划卡片增加"执行"按钮；调用 `POST /plans/{id}/execute` → 弹出 `BatchProgressDialog`；计划卡片展示执行历史 |
