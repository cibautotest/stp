-- 单次执行报告幂等键（playwright-code-execution 变更补充）：
-- 一次执行只应产生一份报告；回调（ExecutionCallbackController）与 10s 定时同步
-- （ExecutionStatusSyncService）是同一执行结果的两条写入路径，以 execution_id
-- 做逻辑去重（回调链路含报告/脚本上传时延迟可能超过同步轮询窗口，曾出现双插）。
ALTER TABLE reports
  ADD COLUMN execution_id VARCHAR(64) DEFAULT NULL
    COMMENT '执行ID（单次执行报告幂等键）',
  ADD INDEX idx_reports_execution_id (execution_id);
