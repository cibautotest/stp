-- 报告目录归属：生成报告时从测试用例的 directory_id 自动写入。
ALTER TABLE `reports`
  ADD COLUMN `directory_id` VARCHAR(64) DEFAULT NULL COMMENT '所属用例目录ID',
  ADD INDEX `idx_report_directory_id` (`directory_id`);
