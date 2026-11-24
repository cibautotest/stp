-- 录制脚本 STALE 竞态保护（playwright-code-execution 变更补充）：
-- 执行下发时记录用例内容哈希（nlp + yamlFlow 的 SHA-256），
-- 上传录制脚本时比对，区分"正常重录"（STALE 发生在下发前，放行）与
-- "执行期间被修改"（旧语义录制结果，拒绝覆盖）。
ALTER TABLE execution_record
  ADD COLUMN dispatched_content_hash VARCHAR(64) DEFAULT NULL
    COMMENT '执行下发时的用例内容哈希(sha256: nlp+yamlFlow)';
