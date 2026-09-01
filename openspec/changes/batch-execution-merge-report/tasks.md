# Tasks: 批量执行测试用例与合并报告

## 1. Database - Schema Migration

- [x] 1.1 修改 `init.sql`：`execution_record` 表新增 `batch_id VARCHAR(128) DEFAULT NULL` 字段 + `idx_batch_id` 索引
- [x] 1.2 修改 `init.sql`：`reports` 表新增 `batch_id VARCHAR(128) DEFAULT NULL`、`type VARCHAR(32) NOT NULL DEFAULT 'SINGLE'`、`merged_report_path VARCHAR(512) DEFAULT NULL` 字段 + `idx_batch_id`、`idx_type` 索引

## 2. Execute Service - Report Merge Module

- [x] 2.1 新建 `src/reports/merge.ts`：实现 `BatchReportMerger` 类，封装 `ReportMergingTool` 的 `append()` 和 `mergeReports()` 调用逻辑
- [x] 2.2 新建 `src/api/routes/merge.ts`：实现 `POST /execute/merge-reports` 路由，接收 `{ executionIds, batchName }` 参数
- [x] 2.3 修改 `src/api/server.ts`：注册 merge 路由到 Fastify 实例

## 3. Platform Service - Entity & DTO Enhancement

- [x] 3.1 修改 `ExecutionRecord.java`：新增 `batchId` 字段（`@TableField("batch_id")`）
- [x] 3.2 修改 `Report.java`：新增 `batchId`、`type`（默认 `"SINGLE"`）、`mergedReportPath` 字段
- [x] 3.3 新建 `model/BatchExecuteRequest.java`：包含 `caseIds` 列表字段
- [x] 3.4 新建 `model/BatchExecuteResponse.java`：包含 `batchId`、`total`、`message` 字段
- [x] 3.5 新建 `model/MergeReportRequest.java`：包含 `executionIds` 列表、`batchName` 字段
- [x] 3.6 新建 `model/MergeReportResponse.java`：包含 `success`、`mergedReportPath`、`mergedReportUrl`、`error` 字段
- [x] 3.7 新建 `model/BatchProgressResponse.java`：包含 `batchId`、`projectId`、`projectName`、`total`、`completed`、`success`、`failed`、`running`、`status`、`cases` 字段

## 4. Platform Service - Service Layer

- [x] 4.1 修改 `CaseExecutionService.java`：`execute()` 方法新增 `batchId` 重载，创建 execution_record 时附带 batch_id
- [x] 4.2 修改 `ExecutionRecordMapper.java`：新增 `selectByBatchId(String batchId)` 方法
- [x] 4.3 新建 `BatchExecutionService.java`：实现 `batchExecute(caseIds)` — 验证同项目、生成 batchId、逐个提交执行
- [x] 4.4 新建 `BatchExecutionService.java`：实现 `getBatchProgress(batchId)` — 查询同批次 execution_record 汇总状态
- [x] 4.5 新建 `BatchExecutionService.java`：实现 `checkAndMergeBatch(batchId)` — 检测全部完成 → 调用合并 → 创建 BATCH report（幂等保护）
- [x] 4.6 修改 `ExecutionStatusSyncService.java`：`syncSingleExecution()` 中判断 batchId，有 batchId 时不创建 SINGLE report，转而调用 `checkAndMergeBatch()`

## 5. Platform Service - API & Feign

- [x] 5.1 修改 `ExecuteClient.java`：新增 `mergeReports(MergeReportRequest)` Feign 方法
- [x] 5.2 新建 `BatchExecutionController.java`：实现 `POST /cases/batch-execute` 端点
- [x] 5.3 新建 `BatchExecutionController.java`：实现 `GET /batch-executions/{batchId}/progress` 端点

## 6. Frontend - API & Types

- [x] 6.1 修改 `types/index.ts`：新增 `BatchProgress`、`BatchCaseStatus` 接口定义
- [x] 6.2 修改 `api/cases.ts`：新增 `batchExecuteCases(caseIds)`、`getBatchProgress(batchId)` API 方法

## 7. Frontend - Batch Execution UI

- [x] 7.1 新建 `components/BatchProgressDialog.vue`：实现进度弹窗，包含 `el-progress` 进度条 + 用例状态列表
- [x] 7.2 实现轮询逻辑：打开弹窗后每 3 秒调用 `getBatchProgress(batchId)`，`status === 'COMPLETED'` 时停止
- [x] 7.3 修改 `views/cases/index.vue`：工具栏新增"批量执行"按钮，校验 `selectedCases.length > 0`
- [x] 7.4 修改 `views/cases/index.vue`：点击批量执行 → 调用 API → 弹出 `BatchProgressDialog`
