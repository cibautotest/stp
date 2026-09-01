## 1. Database - Schema Migration

- [x] 1.1 编写 ALTER TABLE SQL：`reports` 表新增 `name VARCHAR(255) NOT NULL DEFAULT ''` 和 `project_id VARCHAR(64) DEFAULT NULL` 字段，并创建 `idx_project_id` 索引
- [x] 1.2 编写数据回填 SQL：根据 `case_id` 关联 `test_cases` 表，将现有报告的 `name` 填充为用例名、`project_id` 填充为用例的 `project_id`
- [x] 1.3 将迁移 SQL 合并到 `init.sql`（建表语句中直接包含新字段）

## 2. Backend - Entity & API Enhancement

- [x] 2.1 修改 `Report.java` 实体：新增 `name`（`@TableField`）和 `projectId` 数据库字段；新增 `projectName`（`@TableField(exist = false)`）非数据库字段
- [x] 2.2 创建 `ReportMapper.xml`，编写自定义分页查询 SQL：LEFT JOIN `projects` 获取 `projectName`，支持 `projectId` 可选筛选条件
- [x] 2.3 修改 `ReportMapper.java` 新增自定义方法 `pageReportsWithJoin`
- [x] 2.4 修改 `ReportService.pageReports()` 方法，新增 `projectId` 参数，调用 Mapper 的 JOIN 查询方法
- [x] 2.5 修改 `ReportController.list()` 添加 `@RequestParam(required = false) String projectId` 参数
- [x] 2.6 在 `ReportController` 中新增 `DELETE /reports/{id}` 删除接口
- [x] 2.7 在 `ReportService` 中实现 `deleteReport(Long id)` 方法

## 3. Backend - Sync Service Auto-fill

- [x] 3.1 修改 `ExecutionStatusSyncService`：创建 Report 时自动填充 `name`（取 test_case.name）和 `projectId`（取 test_case.project_id）

## 4. Frontend - API & Types

- [x] 4.1 创建 `api/reports.ts`，实现 `getReports(params)`、`getReport(id)`、`deleteReport(id)` 方法
- [x] 4.2 在 `api/index.ts` 中导出 `reports.ts`
- [x] 4.3 重定义 `types/index.ts` 中的 `Report` 接口：`id`, `caseId`, `name`, `projectId`, `projectName`, `status`, `duration`, `nlp`, `url`, `yamlFlow`, `result`, `error`, `logs`, `createdAt`（移除 caseName）

## 5. Frontend - Store Refactoring

- [x] 5.1 创建 `stores/reports.ts`，独立 `useReportStore`，调用后端 API 获取报告数据
- [x] 5.2 Store 中实现：`fetchReports(params)` (支持 projectId/page/size)、`total`、`page`/`size` 响应式状态
- [x] 5.3 Store 中实现 `deleteReport(id)` 方法，删除成功后自动刷新列表
- [x] 5.4 从 `stores/stats.ts` 中移除 `useReportStore` 代码
- [x] 5.5 更新 `stores/index.ts` 导出，从 `./reports` 导出 `useReportStore`

## 6. Frontend - Report List View

- [x] 6.1 重构 `views/reports/index.vue` 工具栏：添加项目筛选下拉框（调用 projectStore 获取项目列表）、刷新按钮
- [x] 6.2 重构报告列表表格列：报告ID、报告名称、所属项目、执行状态（Tag）、执行耗时（ms→秒格式化）、报告时间
- [x] 6.3 实现服务端分页：监听 page/size 变化调用 `reportStore.fetchReports()`，显示后端返回的 total
- [x] 6.4 实现项目筛选：选择项目后传递 projectId 参数重新查询
- [x] 6.5 实现删除功能：点击删除按钮 → 确认弹窗 → 调用 API → 刷新列表

## 7. Frontend - Report Detail Dialog

- [x] 7.1 重构详情弹窗基本信息区：使用 `el-descriptions` 展示报告名称、项目名、状态、耗时、时间
- [x] 7.2 添加目标 URL 展示区：使用 `el-link` 可点击跳转，无 URL 时显示 "-"
- [x] 7.3 添加 NLP 指令展示区：文本展示，超长内容支持展开/折叠
- [x] 7.4 添加 YAML 流程展示区：使用 `el-collapse` 折叠面板，等宽字体代码风格
- [x] 7.5 添加执行结果展示区：JSON 格式化展示（try-catch 解析），无结果时显示 "无执行结果"
- [x] 7.6 添加错误信息展示区：仅 status=FAILED 时显示，红色高亮背景
- [x] 7.7 添加执行日志展示区：深色终端风格代码块，等宽字体，最大高度可滚动
- [x] 7.8 修改 `viewDetail` 方法：调用 `getReport(id)` API 获取完整报告数据
