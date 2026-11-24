-- 录制脚本元数据（playwright-code-execution 变更）
-- test_cases.script（LONGTEXT）在 init.sql 中已预留，直接启用，不重复新增
ALTER TABLE test_cases
  ADD COLUMN script_status VARCHAR(16) DEFAULT 'NONE'
    COMMENT '录制脚本状态: NONE/RECORDED/STALE',
  ADD COLUMN script_source_execution_id VARCHAR(64) DEFAULT NULL
    COMMENT '录制来源执行ID',
  ADD COLUMN script_recorded_at DATETIME DEFAULT NULL
    COMMENT '录制时间';
