# 验证证据：playwright-code-execution

## 2.10 报告幂等修复（一次执行两份报告 216/217）— 2026-11-23

### 根因确认（DB 实测）

- `reports` 216/217 同 executionId `f80747f4-deca-4bde-acc1-fbd50f6f05a4`，created_at 相差 10s（01:21:29 / 01:21:39）；214/215 同 `a96996d7-...` 相差 3s。第一条来自执行引擎回调（ExecutionCallbackController），第二条来自 10s 定时同步（ExecutionStatusSyncService），两条写入路径均无幂等约束。
- 全库重复对（SINGLE 且 result 相同）共 **52 对**。

### 修复实施

1. `Report.java` 加 `executionId` 字段；SQL `V20261125__add_reports_execution_id.sql`（已确认无 BOM）。
2. 新建 `service/ExecutionReportService.upsertSingleReport`：按 execution_id 查重 → 存在则 `updateById` 原位更新（保留 id/createdAt）→ 否则 insert；统一 `apiExchangeMapper.updateReportIdByExecutionId` 关联。
3. `ExecutionCallbackController`（补 `setType("SINGLE")`）与 `ExecutionStatusSyncService.createSingleReport` 两处写入点收敛至该服务；两文件移除直连 ReportMapper/ApiExchangeMapper。
4. `BatchExecutionService` 的 BATCH 合并报告不受影响（batchId 路径，已确认唯一 BATCH 写入点）。

### 验证证据

| 项 | 结果 |
|---|---|
| `mvn -q -pl platform-service -am compile -DskipTests` | EXIT 0 |
| MySQL 迁移 `V20261125` | `SHOW COLUMNS` 返回 `execution_id varchar(64) YES MUL NULL` |
| 历史数据清理：api_exchange.report_id 迁移至保留行 + execution_id 回填 + 删除重复行 | 重复对查询返回空（0 行）；`SELECT id, execution_id` → 214=`a96996d7-...`、216=`f80747f4-...`；api_exchange 两个 execution 各 7 条均指向 214/216 |
| 运行时幂等验证（P1–P3） | **未验证**：需用户重启 platform-service 后执行一次用例实测 |

### 待用户执行

- 重启 platform-service（本次后端 jar 改动需重新部署生效）。
- 按本目录 test-cases.md「五、报告幂等」P1–P3 实测一次执行，确认只生成一份报告。
