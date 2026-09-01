ALTER TABLE `api_exchange`
  ADD COLUMN `report_id` BIGINT DEFAULT NULL COMMENT '关联报告ID' AFTER `id`,
  ADD KEY `idx_api_exchange_report` (`report_id`);
