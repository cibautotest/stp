## Why

当前报告中心模块存在根本性的架构问题：前端 `useReportStore.fetchReports()` 并未调用后端报告 API (`/api/platform/reports`)，而是从用例列表中过滤出 status 为 success/failed 的用例来"伪造"报告数据。这导致：

1. **数据不准确** — 无法展示执行耗时、错误信息、NLP 指令、目标 URL 等数据库 `reports` 表已存储的丰富信息
2. **后端 API 浪费** — `ReportController` 已提供分页查询、按用例查询等接口，但前端完全未对接
3. **详情弹窗简陋** — 日志是从 `script` 字段中用正则提取的，而非使用 `reports.logs` 字段
4. **报告缺少独立标识** — 报告没有自己的名称和项目归属，只能通过关联用例间接获取，耦合度过高

## What Changes

### 数据库层
- `reports` 表新增 `name` 字段（报告名称），作为报告的独立标识
- `reports` 表新增 `project_id` 字段，直接关联 `projects` 表，不再依赖通过 `case_id` 间接获取项目信息

### 后端 API
- `Report` 实体新增 `name`、`projectId`、`projectName` 字段
- `ReportMapper` 分页查询 LEFT JOIN `projects` 表获取 `projectName`（不再 JOIN `test_cases`）
- `ReportController` 分页接口增加 `projectId` 筛选参数
- 新增 `DELETE /reports/{id}` 删除接口
- 报告创建/同步时自动填充 `name`（默认取用例名）和 `project_id`

### 前端
- **API 层**：新建 `api/reports.ts`，提供 `getReports`、`getReport`、`deleteReport` 等方法
- **Store**：从 `stores/stats.ts` 抽取为独立 `stores/reports.ts`，调用后端 API，支持服务端分页
- **Types**：`Report` 类型补齐 `name`、`projectId`、`projectName`、`nlp`、`url`、`yamlFlow`、`result`、`error`、`logs`、`duration` 等字段；移除 `caseName`
- **报告列表**：展示报告名称（非用例名）、所属项目、状态、耗时、时间；支持按项目筛选；服务端分页；删除操作
- **报告详情弹窗**：展示全部字段（报告名称、项目、状态、耗时、时间、目标 URL、NLP 指令、YAML 流程、执行结果、错误信息、执行日志）

## Capabilities

### New Capabilities

- `report-list`: 报告列表功能 — 包含服务端分页查询、按项目筛选、报告列表展示（报告名称、项目、状态、耗时、时间）、删除操作
- `report-detail`: 报告详情功能 — 详情弹窗展示全部报告字段（基本信息、目标 URL、NLP 指令、YAML 流程、执行结果、错误信息、执行日志）
- `report-api`: 报告后端 API 增强 — 分页接口支持 projectId 筛选和 JOIN projects 关联查询、新增删除接口、新增 name/project_id 字段

### Modified Capabilities

_(无现有 capability 需要修改)_

## Impact

**数据库**：
- `reports` 表 — ALTER 新增 `name` 和 `project_id` 字段

**后端**：
- `Report.java` — 新增 `name`、`projectId`、`projectName` 字段
- `ReportService.java` — 分页查询改为 LEFT JOIN `projects`；新增删除方法；创建/同步时填充 name 和 project_id
- `ReportController.java` — 新增 projectId 参数和 DELETE 端点
- `ReportMapper.java` / `ReportMapper.xml` — 自定义 JOIN 查询 SQL
- `ExecutionStatusSyncService.java` — 同步报告时填充 `name` 和 `project_id`

**前端**：
- `api/reports.ts` — 新增文件
- `types/index.ts` — Report 类型重新定义
- `stores/stats.ts` — 移除 useReportStore
- `stores/reports.ts` — 新增文件，独立 report store
- `stores/index.ts` — 更新导出
- `views/reports/index.vue` — 重构列表和详情弹窗
