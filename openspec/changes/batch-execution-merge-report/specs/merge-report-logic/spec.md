# Spec: 合并报告逻辑

## 概述

当批量执行的所有子用例完成时，Platform Service 调用 Execute Service 的合并 API，使用 Midscene `ReportMergingTool` 将多个独立 HTML 报告合并为一个统一报告，并在 `reports` 表中创建一条 BATCH 类型记录。

## 合并触发时机

在 `ExecutionStatusSyncService.syncSingleExecution()` 中：

```
每个 execution_record 同步完成时:
  ├─ 有 batch_id:
  │    ├─ 不创建 SINGLE report
  │    └─ 检查同批次是否全部完成
  │         ├─ 查询: SELECT * FROM execution_record WHERE batch_id = ?
  │         ├─ 判断: 所有记录状态均为终态 (SUCCESS / FAILED)
  │         └─ 是 → 触发合并流程
  │              否 → 等待下次同步
  │
  └─ 无 batch_id:
       └─ 创建 SINGLE report (现有逻辑不变)
```

## 合并流程

```
checkAndMergeBatch(batchId):
  │
  ├─ 1. 幂等检查: SELECT * FROM reports WHERE batch_id = ? AND type = 'BATCH'
  │    └─ 已存在 → 返回 (防止重复合并)
  │
  ├─ 2. 查询同批次所有 execution_record
  │    ├─ 获取所有 executionId 列表
  │    ├─ 计算汇总: total, successCount, failedCount, totalDuration
  │    └─ 查询 project 信息
  │
  ├─ 3. 调用 Execute Service 合并 API
  │    ├─ POST /execute/merge-reports
  │    ├─ body: { executionIds: [...], batchName: batchId }
  │    └─ 获取: { mergedReportPath, mergedReportUrl }
  │
  ├─ 4. 创建 BATCH 类型 report 记录
  │    ├─ batch_id = batchId
  │    ├─ type = "BATCH"
  │    ├─ case_id = NULL (批量报告不关联单一用例)
  │    ├─ project_id = 从 execution_record 关联获取
  │    ├─ name = "{项目名} - 批量测试报告"
  │    ├─ status = failedCount > 0 ? "FAILED" : "SUCCESS"
  │    ├─ duration = totalDuration
  │    ├─ merged_report_path = mergedReportPath
  │    ├─ result = mergedReportUrl (用于前端访问)
  │    └─ created_at = NOW()
  │
  └─ 5. 日志记录
```

## Execute Service 合并实现

`BatchReportMerger.mergeReports()`:

```
输入: executionIds[], batchName?
  │
  ├─ 遍历每个 executionId:
  │    ├─ 从 ExecutionStore 获取: status, name, duration
  │    ├─ 从 ReportManager 获取报告文件路径
  │    └─ 文件存在 → ReportMergingTool.append({
  │         reportFilePath: 文件路径,
  │         reportAttributes: {
  │           testId: executionId,
  │           testTitle: name || executionId,
  │           testDescription: "自动化测试",
  │           testDuration: duration || 0,
  │           testStatus: 映射状态 (completed→passed, failed→failed),
  │         }
  │       })
  │
  ├─ 至少 1 个有效报告:
  │    └─ ReportMergingTool.mergeReports(batchName || 'AUTO', { overwrite: true })
  │         └─ 返回: { mergedReportPath, mergedReportUrl }
  │
  └─ 无有效报告:
       └─ 返回 null
```

**状态映射**:
| Execute Service 状态 | ReportMergingTool testStatus |
|---------------------|---------------------------|
| completed | passed |
| failed | failed |
| cancelled | skipped |

## 容错处理

| 场景 | 处理方式 |
|------|----------|
| 某个子用例报告文件不存在 | 跳过该用例，继续合并其他 |
| Execute Service 重启后内存记录丢失 | 从文件系统检查报告是否存在，无法获取名称/状态时用 executionId 充当 |
| 合并 API 调用失败 | 不创建 BATCH report，下次同步重试（幂等检查保证不会重复合并） |
| 并发同步同时检测到批次完成 | 数据库层面用 batch_id + type='BATCH' 做唯一性检查 |

## 报告访问

合并后的 HTML 报告通过 Execute Service 已有的报告路由访问：

```
GET http://localhost:3001/reports/{batchId}    → 返回合并后的 HTML
```

前端可通过 Gateway 代理访问：
```
GET http://localhost:8080/api/execute/reports/{batchId}
```
