-- CODE 执行步骤截图模式（playwright-code-execution 变更补充）：
-- ERROR = 仅失败/AI兜底步骤截图（默认，控制报告体积）；ALL = 全部步骤截图（便于人工审读）
ALTER TABLE ai_config
  ADD COLUMN code_screenshot_mode VARCHAR(8) DEFAULT 'ERROR'
    COMMENT 'CODE执行截图模式: ERROR/ALL';
