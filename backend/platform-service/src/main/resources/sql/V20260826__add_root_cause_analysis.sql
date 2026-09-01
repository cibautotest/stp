CREATE TABLE IF NOT EXISTS `root_cause_analysis` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT 'analysis id',
  `report_id` BIGINT NOT NULL COMMENT 'related report id',
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING/RUNNING/COMPLETED/FAILED',
  `model_name` VARCHAR(128) DEFAULT NULL COMMENT 'AI model name',
  `prompt` LONGTEXT COMMENT 'prompt sent to AI model',
  `reasoning` LONGTEXT COMMENT 'model reasoning stream',
  `analysis` LONGTEXT COMMENT 'final root cause analysis',
  `error_message` TEXT COMMENT 'AI analysis error',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'created time',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'updated time',
  PRIMARY KEY (`id`),
  KEY `idx_rca_report_id` (`report_id`),
  KEY `idx_rca_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI root cause analysis records';
