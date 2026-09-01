# Spec: 批量执行 API

## 概述

Platform Service 提供批量执行测试用例和查询批次进度的 REST API。

## 端点

### POST /cases/batch-execute

批量执行同一项目下的多个测试用例。

**Request**:
```json
{
  "caseIds": ["case-uuid-1", "case-uuid-2", "case-uuid-3"]
}
```

**校验规则**:
- `caseIds` 不可为空，至少包含 1 个 ID
- 所有 `caseIds` 必须属于同一个 `project_id`
- 每个 `caseId` 对应的用例必须存在
- 每个用例必须有 `yamlFlow`（可执行）

**Response (200)**:
```json
{
  "batchId": "batch-uuid-xxx",
  "total": 3,
  "message": "已提交 3 个用例执行"
}
```

**Response (400)**:
```json
{ "error": "用例不能为空" }
{ "error": "用例 [case-x] 不属于同一项目" }
{ "error": "用例 [case-x] 不存在" }
{ "error": "用例 [case-x] 无可执行的 YAML 流程" }
```

---

### GET /batch-executions/{batchId}/progress

查询批量执行的进度。

**Response (200)**:
```json
{
  "batchId": "batch-uuid-xxx",
  "projectId": "proj-uuid",
  "projectName": "电商平台",
  "total": 3,
  "completed": 2,
  "success": 1,
  "failed": 1,
  "running": 1,
  "status": "RUNNING",
  "cases": [
    {
      "caseId": "case-uuid-1",
      "caseName": "登录功能测试",
      "executionId": "exec-uuid-1",
      "status": "SUCCESS",
      "duration": 12300
    },
    {
      "caseId": "case-uuid-2",
      "caseName": "搜索功能测试",
      "executionId": "exec-uuid-2",
      "status": "FAILED",
      "duration": 8100
    },
    {
      "caseId": "case-uuid-3",
      "caseName": "下单功能测试",
      "executionId": "exec-uuid-3",
      "status": "RUNNING",
      "duration": null
    }
  ]
}
```

**status 枚举**:
- `RUNNING` — 存在未完成的子任务
- `COMPLETED` — 所有子任务已达终态

**Response (404)**:
```json
{ "error": "批次不存在" }
```

---

### POST /execute/merge-reports (Execute Service)

合并多个执行报告为统一 HTML。

**Request**:
```json
{
  "executionIds": ["exec-uuid-1", "exec-uuid-2", "exec-uuid-3"],
  "batchName": "batch-uuid-xxx"
}
```

**Response (200)**:
```json
{
  "success": true,
  "mergedReportPath": "batch-uuid-xxx.html",
  "mergedReportUrl": "http://localhost:3001/reports/batch-uuid-xxx"
}
```

**Response (400)**:
```json
{
  "success": false,
  "error": "NO_VALID_REPORTS",
  "message": "没有找到可合并的报告文件"
}
```
