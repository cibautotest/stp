## Context

当前报告中心模块前后端脱节：后端 `reports` 表已存储了丰富的执行数据（NLP 指令、目标 URL、YAML 流程、执行结果 JSON、错误信息、执行日志等字段），`ReportController` 也已提供分页查询和按用例查询的 API。但前端 `useReportStore.fetchReports()` 完全绕过后端 API，直接从 `cases` 列表中过滤 status 为 success/failed 的记录来"伪造"报告，导致大量信息丢失。

此外，`reports` 表目前没有独立的名称和项目归属，所有信息都依赖通过 `case_id` 关联 `test_cases` 表间接获取。这种设计耦合度高，用例删除后报告的上下文信息就丢失了。

技术栈：Spring Boot 2.7 + MyBatis-Plus + Vue 3 + Element Plus + Pinia。

## Goals / Non-Goals

**Goals:**
- `reports` 表新增 `name` 字段（报告名称）和 `project_id` 字段（直接关联项目），解耦报告与用例的强依赖
- 前端报告列表通过后端 API 获取真实报告数据
- 列表展示关键信息：报告名称（非用例名）、所属项目、状态、执行耗时、报告生成时间
- 支持按项目筛选报告
- 报告详情弹窗展示 `reports` 表全部字段信息
- 提供报告删除功能（前后端完整实现）

**Non-Goals:**
- 不涉及报告导出（PDF/Excel 等格式）
- 不涉及报告统计图表（成功率趋势等）
- 不涉及前端搜索功能（按报告名搜索）
- 不涉及 `execution_record` 表改动
- 不涉及用例名称、项目名称的展示（报告有自己的 name 和 project_id）

## Decisions

### D1: 报告表新增 name 和 project_id 字段

**决策**: 对 `reports` 表执行 ALTER TABLE，新增 `name VARCHAR(255)` 和 `project_id VARCHAR(64)` 字段。报告创建/同步时自动填充 `name`（默认取关联用例名）和 `project_id`（取用例的 project_id）。

**替代方案**: 继续通过 JOIN test_cases 获取名称和项目 → 耦合度高，用例删除后报告信息丢失。

**选择理由**: 报告作为独立的实体应有自己的名称和项目归属。存储冗余字段以保持数据独立性，避免级联影响。

### D2: 后端分页查询只 JOIN projects 表

**决策**: 在 `ReportService.pageReports()` 中使用自定义 SQL LEFT JOIN `projects` 表获取 `projectName`，不再 JOIN `test_cases`。

**替代方案**: JOIN test_cases 和 projects 两张表 → 报告有自己的 name 和 project_id，无需再 JOIN test_cases 获取名称。

**选择理由**: 报告已有独立 name 和 project_id 字段，只需一次 JOIN 即可获取项目名。查询更简洁，性能更优。

### D3: 前端 Store 独立化

**决策**: 从 `stores/stats.ts` 中抽取 `useReportStore` 为独立文件 `stores/reports.ts`，使用独立的 API 调用。

**替代方案**: 在现有 `stores/stats.ts` 中修改 → 该文件同时包含 `useConfigStore`，职责不清晰。

**选择理由**: 职责单一，便于维护。`api/reports.ts` 作为独立的 API 模块配套使用。

### D4: 前端 Report 类型重新定义

**决策**: 完全重新定义 `Report` 接口以匹配后端 `reports` 表和 JOIN 查询结果，包含：`id`, `caseId`, `name`, `projectId`, `projectName`, `status`, `duration`, `nlp`, `url`, `yamlFlow`, `result`, `error`, `logs`, `createdAt`。

**选择理由**: 前端现有 `Report` 类型仅有 8 个字段且命名不规范（snake_case），后端返回的数据无法正确映射。移除 `caseName`，新增 `name` 作为报告独立名称。

### D5: 详情弹窗信息分区展示

**决策**: 详情弹窗按信息类型分区展示：
1. **基本信息区** — el-descriptions: 报告名称、项目、状态、耗时、时间
2. **目标 URL 区** — 可点击链接跳转
3. **NLP 指令区** — 文本展示，超长折叠
4. **YAML 流程区** — el-collapse 折叠，代码风格展示
5. **执行结果区** — JSON 格式化展示（result 字段）
6. **错误信息区** — 仅 status=FAILED 时显示，红色高亮
7. **执行日志区** — 深色终端风格，保留现有样式

## Risks / Trade-offs

- **[数据冗余]** → `name` 和 `project_id` 与 test_cases 存在冗余 → 可接受的冗余，保证报告独立性
- **[历史数据迁移]** → 现有 reports 记录的 name 和 project_id 为空 → 通过脚本回填（根据 case_id 查 test_cases）
- **[JOIN 查询性能]** → reports 表数据量增长后 JOIN 可能变慢 → 通过 `idx_project_id` 索引缓解
- **[旧 Report 类型兼容]** → 重定义 Report 类型可能导致其他引用处报错 → 全面检查并更新所有引用
- **[result 字段为 JSON 字符串]** → 前端展示需 JSON.parse，解析失败需兜底 → 使用 try-catch 包裹，失败时展示原始字符串
