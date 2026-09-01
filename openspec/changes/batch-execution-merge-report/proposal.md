# Proposal: 批量执行测试用例与合并报告

## 背景

当前平台仅支持单个用例的执行，用户每次只能执行一个测试用例。在实际测试场景中，用户往往需要对同一个项目下的多个用例进行批量执行（如回归测试、全量测试等），并期望获得一份统一的测试报告。

Midscene 框架提供了 `ReportMergingTool`，可以将多个独立的 HTML 可视化报告合并为一个统一的 HTML 报告，便于集中查看和管理。

## 问题

1. **无法批量执行** — 用户只能逐个点击执行用例，效率低下
2. **报告分散** — 每个用例生成独立报告，缺乏统一的批量报告视图
3. **缺少批量进度** — 无法一眼看出批量执行的整体进展

## 目标

1. 支持同一项目下的多个用例批量执行，利用现有队列并发机制
2. 所有子用例执行完成后，使用 Midscene `ReportMergingTool` 合并生成统一 HTML 报告
3. `reports` 表通过 `type` 字段区分：`SINGLE`（单条执行）和 `BATCH`（批量合并）
4. 批量执行中的子用例不再创建 SINGLE 报告，仅在全部完成后创建一条 BATCH 报告
5. 前端提供"X/N 已完成"进度条展示批量执行进度

## 范围

### 包含

- Execute Service: 新增报告合并 API (`POST /execute/merge-reports`)
- Platform Service: 新增批量执行 API + 批次进度查询 API + 合并触发逻辑
- Platform Service: `execution_record` 表新增 `batch_id` 字段
- Platform Service: `reports` 表新增 `type`、`batch_id`、`merged_report_path` 字段
- Platform Service: `ExecutionStatusSyncService` 增强为支持批次检测与合并触发
- Frontend: 用例列表新增"批量执行"按钮
- Frontend: 新增批量执行进度弹窗组件

### 不包含

- 跨项目批量执行
- 批量执行中的实时日志流
- 批量取消功能
- 执行失败后的自动重试

## 技术约束

- 前端通过 Platform Service 间接调用 Execute Service，不直接交互
- Midscene `ReportMergingTool` 是 Node.js API，合并逻辑必须在 Execute Service 执行
- 合并报告文件存储在 Execute Service 的 `midscene_run/report/` 目录下
- 并发控制复用现有 WorkerPool（最大并发 3），无需修改队列机制
- 状态同步复用现有 10 秒轮询机制，合并检测嵌入同步流程
