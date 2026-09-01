# Design: 批量执行测试用例与合并报告

## 架构概览

```
┌──────────┐                    ┌──────────────────┐                  ┌──────────────────────┐
│ Frontend │                    │ Platform Service  │                  │   Execute Service     │
│  Vue 3   │                    │   Java/Spring     │                  │   Node.js/Fastify     │
└────┬─────┘                    └────────┬─────────┘                  └──────────┬───────────┘
     │                                   │                                       │
     │ ① POST /cases/batch-execute       │                                       │
     │   { caseIds: [...] }              │                                       │
     │──────────────────────────────────▶│                                       │
     │                                   │ 验证同项目 + 生成 batchId              │
     │                                   │                                       │
     │                                   │ ② 循环 POST /execute/async (已有API)  │
     │                                   │   创建 execution_record (带 batch_id) │
     │                                   │──────────────────────────────────────▶│
     │                                   │              WorkerPool 并发执行       │
     │  return { batchId, total }        │                                       │
     │◀──────────────────────────────────│                                       │
     │                                   │                                       │
     │ ③ GET /batch-executions/{id}/progress (轮询 3s)                          │
     │──────────────────────────────────▶│  ④ 定时同步 (10s)                    │
     │◀──────────────────────────────────│◀─────────────────────────────────────│
     │                                   │                                       │
     │  ... 全部完成后 ...                │  ⑤ 检测批次完成                      │
     │                                   │  POST /execute/merge-reports          │
     │                                   │──────────────────────────────────────▶│
     │                                   │  ReportMergingTool 合并               │
     │                                   │◀─────────────────────────────────────│
     │                                   │  ⑥ 创建 BATCH 类型 report            │
     │  return { status: "COMPLETED" }   │                                       │
     │◀──────────────────────────────────│                                       │
```

## 数据库设计

### execution_record 表 — 新增字段

```sql
ALTER TABLE `execution_record`
  ADD COLUMN `batch_id` VARCHAR(128) DEFAULT NULL COMMENT '批次ID（批量执行时关联）' AFTER `case_id`,
  ADD INDEX `idx_batch_id` (`batch_id`);
```

### reports 表 — 新增字段

```sql
ALTER TABLE `reports`
  ADD COLUMN `batch_id` VARCHAR(128) DEFAULT NULL COMMENT '批次ID' AFTER `case_id`,
  ADD COLUMN `type` VARCHAR(32) NOT NULL DEFAULT 'SINGLE' COMMENT 'SINGLE/BATCH' AFTER `batch_id`,
  ADD COLUMN `merged_report_path` VARCHAR(512) DEFAULT NULL COMMENT '合并报告文件路径' AFTER `type`,
  ADD INDEX `idx_batch_id` (`batch_id`),
  ADD INDEX `idx_type` (`type`);
```

### 数据示例

```
reports 表:
┌────┬─────────┬──────────┬───────┬──────────────────┬───────────────────────┐
│ id │ case_id │ batch_id │ type  │ name             │ merged_report_path    │
├────┼─────────┼──────────┼───────┼──────────────────┼───────────────────────┤
│ 101│ case-a  │ NULL     │ SINGLE│ 登录功能测试     │ NULL                  │ ← 单个执行
│ 102│ NULL    │ batch-1  │ BATCH │ 批量测试报告     │ batch-1.html          │ ← 批量合并
│ 103│ case-d  │ NULL     │ SINGLE│ 支付功能测试     │ NULL                  │ ← 单个执行
└────┴─────────┴──────────┴───────┴──────────────────┴───────────────────────┘
```

**核心规则**：
- `type = SINGLE` + `batch_id = NULL` → 单个用例执行时创建（保持现有行为）
- `type = BATCH` + `batch_id = xxx` → 批量执行全部完成后创建一条
- 批量执行中的子用例**不**创建 SINGLE 报告

## Execute Service 设计

### 新增: 报告合并模块

**文件**: `execute-service/src/reports/merge.ts`

```typescript
export class BatchReportMerger {
  constructor(
    private reportManager: ReportManager,
    private store: ExecutionStore,
  ) {}

  /**
   * 合并多个执行报告为统一 HTML
   * @param executionIds 各子任务的 executionId
   * @param batchName 合并报告文件名（可选）
   * @returns { mergedReportPath, mergedReportUrl }
   */
  async mergeReports(
    executionIds: string[],
    batchName?: string,
  ): Promise<{ mergedReportPath: string; mergedReportUrl: string } | null>
}
```

实现要点：
1. 遍历 executionIds，从 ExecutionStore 获取每个执行的状态、名称、耗时
2. 通过 `reportManager.getReportPath(executionId)` 获取每个报告文件路径
3. 跳过文件不存在的记录（容错）
4. 使用 `ReportMergingTool` 逐个 `.append()`
5. 调用 `.mergeReports(batchName)` 生成合并 HTML
6. 返回文件名和访问 URL

### 新增: 合并报告路由

**文件**: `execute-service/src/api/routes/merge.ts`

```
POST /execute/merge-reports
Content-Type: application/json

Request:
{
  "executionIds": ["exec-1", "exec-2", "exec-3"],
  "batchName": "batch-abc"      // 可选
}

Response (200):
{
  "success": true,
  "mergedReportPath": "batch-abc.html",
  "mergedReportUrl": "http://localhost:3001/reports/batch-abc"
}

Response (400): 无有效报告
{
  "success": false,
  "error": "NO_VALID_REPORTS",
  "message": "没有找到可合并的报告文件"
}
```

### 报告访问路由扩展

已有的 `GET /reports/:executionId` 路由天然支持合并报告：
- 单条报告: `GET /reports/{executionId}` → `{executionId}.html`
- 合并报告: `GET /reports/{batchName}` → `{batchName}.html`

无需修改。

## Platform Service 设计

### 新增: BatchExecutionController

**文件**: `controller/BatchExecutionController.java`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/cases/batch-execute` | 批量执行用例 |
| GET | `/batch-executions/{batchId}/progress` | 查询批次进度 |

### 新增: BatchExecutionService

**文件**: `service/BatchExecutionService.java`

```java
@Service
public class BatchExecutionService {

    /**
     * 批量执行用例
     * 1. 验证所有 caseIds 属于同一项目
     * 2. 生成 batchId (UUID)
     * 3. 逐个调用 CaseExecutionService.execute() 提交执行
     * 4. 创建 execution_record 时附带 batch_id
     * @return batchId
     */
    public String batchExecute(List<String> caseIds)

    /**
     * 查询批次进度
     * @return { batchId, total, completed, success, failed, running, status, cases[] }
     */
    public BatchProgressResponse getBatchProgress(String batchId)

    /**
     * 检查批次是否全部完成，如果是则触发合并
     * 由 ExecutionStatusSyncService 在每次同步完成后调用
     */
    public void checkAndMergeBatch(String batchId)
}
```

### 修改: CaseExecutionService

现有 `execute()` 方法新增重载，支持传入 `batchId`：

```java
// 现有方法保持不变
public String execute(String caseId, String customYaml)

// 新增重载
public String execute(String caseId, String customYaml, String batchId)
```

在 `createExecutionRecord()` 中设置 `record.setBatchId(batchId)`。

### 修改: ExecutionRecord 实体

```java
@TableField("batch_id")
private String batchId;
```

### 修改: Report 实体

```java
@TableField("batch_id")
private String batchId;

@TableField("type")
private String type;  // "SINGLE" or "BATCH"

@TableField("merged_report_path")
private String mergedReportPath;
```

### 修改: ExecutionStatusSyncService

核心逻辑变更：

```
syncSingleExecution(record):
  │
  ├─ 1. 更新 execution_record 状态
  ├─ 2. 查询并更新 test_case 状态
  │
  ├─ 3. 判断是否有 batchId
  │     ├─ 有 batchId (批量执行):
  │     │    ├─ 不创建 SINGLE report
  │     │    └─ 检查同 batchId 是否全部完成
  │     │         └─ 全部完成 → BatchExecutionService.checkAndMergeBatch()
  │     │
  │     └─ 无 batchId (单个执行):
  │          └─ 创建 SINGLE report (保持现有逻辑不变)
  │
  └─ 4. 合并流程 (checkAndMergeBatch):
       ├─ 查询同 batchId 的所有 execution_record
       ├─ 检查是否全部为终态 (SUCCESS/FAILED)
       ├─ 是 → 调用 ExecuteClient.mergeReports()
       ├─ 创建 BATCH 类型 report 记录
       └─ 用 batchId 做幂等保护 (防止重复合并)
```

### 新增: ExecuteClient Feign 方法

```java
@PostMapping(path = "/execute/merge-reports", consumes = "application/json")
MergeReportResponse mergeReports(@RequestBody MergeReportRequest request);
```

### 新增: DTO 模型

```java
// MergeReportRequest
public class MergeReportRequest {
    private List<String> executionIds;
    private String batchName;
}

// MergeReportResponse
public class MergeReportResponse {
    private boolean success;
    private String mergedReportPath;
    private String mergedReportUrl;
    private String error;
}

// BatchExecuteRequest
public class BatchExecuteRequest {
    private List<String> caseIds;
}

// BatchExecuteResponse
public class BatchExecuteResponse {
    private String batchId;
    private int total;
    private String message;
}

// BatchProgressResponse
public class BatchProgressResponse {
    private String batchId;
    private String projectId;
    private String projectName;
    private int total;
    private int completed;
    private int success;
    private int failed;
    private int running;
    private String status;  // RUNNING / COMPLETED
    private List<BatchCaseStatus> cases;
}
```

## Frontend 设计

### 新增 API 方法

**文件**: `frontend/src/api/cases.ts`

```typescript
// 批量执行
export const batchExecuteCases = (caseIds: string[]) =>
  request.post<{ batchId: string; total: number }>('/platform/cases/batch-execute', { caseIds })

// 查询批次进度
export const getBatchProgress = (batchId: string) =>
  request.get<BatchProgress>(`/platform/batch-executions/${batchId}/progress`)
```

### 新增类型定义

**文件**: `frontend/src/types/index.ts`

```typescript
export interface BatchProgress {
  batchId: string
  projectId: string
  projectName: string
  total: number
  completed: number
  success: number
  failed: number
  running: number
  status: 'RUNNING' | 'COMPLETED'
  cases: BatchCaseStatus[]
}

export interface BatchCaseStatus {
  caseId: string
  caseName: string
  executionId: string
  status: 'SUCCESS' | 'FAILED' | 'RUNNING'
  duration?: number
}
```

### 新增: 批量执行进度弹窗

**文件**: `frontend/src/components/BatchProgressDialog.vue`

```
┌──────────────────────────────────────┐
│  批量执行进度                     ✕  │
├──────────────────────────────────────┤
│                                      │
│  ████████████░░░░░░  2/3 已完成      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ ✓ 登录功能测试   成功  12.3s │    │
│  │ ✗ 搜索功能测试   失败   8.1s │    │
│  │ ◎ 下单功能测试   执行中...  │    │
│  └──────────────────────────────┘    │
│                                      │
│           [关闭]                     │
└──────────────────────────────────────┘
```

核心行为：
- 打开后立即开始轮询 `getBatchProgress(batchId)`，间隔 3 秒
- `el-progress` 显示 `completed/total` 百分比
- `el-table` 显示每个用例的状态、耗时
- `status === 'COMPLETED'` 时停止轮询

### 修改: 用例列表视图

**文件**: `frontend/src/views/cases/index.vue`

- 工具栏新增"批量执行"按钮（复用现有 `selectedCases` 多选数据）
- 点击后校验选中的用例是否 > 0
- 调用 `batchExecuteCases(caseIds)` 获取 batchId
- 弹出 `BatchProgressDialog`，传入 batchId

## 合并时机与幂等保护

```
ExecutionStatusSyncService 每 10 秒轮询:
  │
  ├─ 遍历 RUNNING 的 execution_record
  │
  └─ 对每条记录:
       ├─ 查询 Execute Service 状态
       ├─ 更新 execution_record + test_case 状态
       │
       ├─ if (batchId != null):
       │    ├─ 不创建 report
       │    └─ 查询同 batchId 的所有 records
       │         ├─ 存在非终态 → 跳过
       │         └─ 全部终态 + 尚无 BATCH report → 合并
       │              ├─ 检查 reports 表: SELECT * FROM reports WHERE batch_id = ? AND type = 'BATCH'
       │              ├─ 已存在 → 跳过（幂等）
       │              └─ 不存在 → 调用合并 → 插入 BATCH report
       │
       └─ else:
            └─ 创建 SINGLE report (现有逻辑)
```

## 文件变更清单

### Execute Service (新增 2 文件 + 修改 1 文件)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/reports/merge.ts` | 新增 | BatchReportMerger 类 |
| `src/api/routes/merge.ts` | 新增 | POST /execute/merge-reports 路由 |
| `src/api/server.ts` | 修改 | 注册 merge 路由 |

### Platform Service (新增 3 文件 + 修改 5 文件)

| 文件 | 操作 | 说明 |
|------|------|------|
| `controller/BatchExecutionController.java` | 新增 | 批量执行 + 进度查询端点 |
| `service/BatchExecutionService.java` | 新增 | 批量执行编排 + 合并触发 |
| `model/BatchExecuteRequest.java` | 新增 | 请求 DTO |
| `model/MergeReportRequest.java` | 新增 | 合并请求 DTO |
| `model/MergeReportResponse.java` | 新增 | 合并响应 DTO |
| `model/BatchProgressResponse.java` | 新增 | 进度响应 DTO |
| `entity/ExecutionRecord.java` | 修改 | 新增 batchId 字段 |
| `entity/Report.java` | 修改 | 新增 batchId、type、mergedReportPath |
| `feign/ExecuteClient.java` | 修改 | 新增 mergeReports 方法 |
| `service/CaseExecutionService.java` | 修改 | execute() 支持 batchId 参数 |
| `service/ExecutionStatusSyncService.java` | 修改 | 批次检测 + 合并触发 |
| `mapper/ExecutionRecordMapper.java` | 修改 | 新增 selectByBatchId 方法 |

### Frontend (新增 2 文件 + 修改 2 文件)

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/BatchProgressDialog.vue` | 新增 | 进度弹窗组件 |
| `src/api/cases.ts` | 修改 | 新增批量 API 方法 |
| `src/types/index.ts` | 修改 | 新增 BatchProgress 等类型 |
| `src/views/cases/index.vue` | 修改 | 新增批量执行按钮 |

### 数据库

| 文件 | 操作 | 说明 |
|------|------|------|
| `resources/sql/init.sql` | 修改 | execution_record 加 batch_id；reports 加 batch_id、type、merged_report_path |
