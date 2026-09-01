## Context

测试计划模块（`test-plan-management` change）已完成计划的 CRUD 和用例关联管理。批量执行模块（`batch-execution-merge-report` change）已实现批量提交、进度轮询、合并报告。但两个模块之间没有连接——计划页面无法触发执行，批量执行入口在用例列表页的勾选框。

本设计将两座"桥"连接起来：用户点击计划上的"执行"按钮 → 按 sort_order 串行提交用例 → 复用 BatchProgressDialog 展示进度 → 执行完成后记录计划执行历史。

## Goals / Non-Goals

**Goals:**
- 计划卡片上提供"执行"按钮，一键触发整个计划的执行
- 按 `test_plan_cases.sort_order` 升序**串行**执行：用例 N 完成后才提交用例 N+1
- 所有用例共享同一个 batchId，复用现有 BatchProgressDialog 弹窗展示进度
- 执行完成后自动触发合并报告（复用 `checkAndMergeBatch`）
- 记录计划执行历史：`last_executed_at`、`last_execution_result`、`last_batch_id`
- 计划页面能直观看到每个计划的最近执行状态

**Non-Goals:**
- 不修改 execute-service（完全复用现有接口）
- 不支持"暂停/取消"计划执行（v1 仅支持串行跑完或失败）
- 不支持并行执行模式（用户已明确选择串行）
- 不生成计划维度的独立报告（复用现有 BATCH 合并报告）

## Decisions

### 1. 串行执行的实现方式：Platform-Service `@Async` 调度

**选择**：在 platform-service 中新建 `PlanExecutionService`，使用 `@Async` 方法逐个提交用例并轮询等待完成。

**为什么不选**：
- ~~修改 execute-service 增加 serial 模式~~：execute-service 是独立微服务，改它成本高、耦合重
- ~~全部提交到 WorkerPool 依赖 FIFO~~：WorkerPool 并发度为 3，不保证串行完成顺序

**实现流程**：

```
POST /plans/{id}/execute
  → 验证计划存在、有用例
  → 生成 batchId，立即返回 { batchId, totalCases }
  → @Async 后台线程：
       for each case (sorted by sort_order):
         ① caseExecutionService.execute(caseId, null, batchId) → executionId
         ② 轮询 execution_record.status，每 2s 查一次，直到 != RUNNING
         ③ 如果 FAILED → 标记有失败，继续执行下一个
       after all cases complete:
         ④ checkAndMergeBatch(batchId) → 生成合并报告
         ⑤ 更新 test_plans 的 last_executed_at / last_execution_result / last_batch_id
```

**关键参数**：
- 轮询间隔：2 秒
- 单个用例最大等待时间：10 分钟（超时标记为 FAILED 并继续下一个）
- `@Async` 线程池：复用 Spring 默认 `SimpleAsyncTaskExecutor`

### 2. 执行历史存储：test_plans 表新增 3 列

`last_execution_result` 取值：
- `PASSED` — 全部通过
- `FAILED` — 全部失败（极端情况）
- `2_FAILED` — N 个失败（N 为失败数量），方便前端快速展示

### 3. 前端入口：计划卡片右侧"执行"按钮

在现有 `plans/index.vue` 的 `plan-actions` 区域新增一个"执行"按钮，与"编辑"、"删除"并列。点击后：
1. 调用 `POST /api/platform/plans/{id}/execute`
2. 拿到 `{ batchId, totalCases }` 后立即弹出 `BatchProgressDialog`
3. BatchProgressDialog 自动轮询 `GET /api/platform/execute/batch/{batchId}/progress`
4. 关闭弹窗或执行完成后，刷新计划列表以展示最新执行历史

### 4. 防重复执行

计划执行期间（存在 RUNNING 状态的 execution_record 关联到该 plan 的 last_batch_id），再次点击"执行"按钮应提示"该计划正在执行中，请等待完成"。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| 串行执行耗时长（N 个用例 × 单用例平均耗时） | 前端弹窗实时展示当前进度和已完成用例；支持"后台执行"关闭弹窗 |
| `@Async` 线程崩溃会导致执行卡死 | 单个用例提交失败不中断整体流程；设置 10 分钟超时；执行完成后一定更新计划状态 |
| 轮询 DB 增加负载 | 2s 间隔，单次查询轻量，仅在计划执行期间 |
| test_plans 表字段变更需迁移 | 新增列允许 NULL，旧数据自然兼容 |

## Open Questions

- 是否需要计划执行完成后的通知（站内信/WebSocket 推送）？→ v1 不做，用户关闭弹窗后刷新页面即可
- 如果计划中某个用例本身没有 yaml_script（无法执行）怎么办？→ 跳过并标记为 FAILED，继续执行下一个
