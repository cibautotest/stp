-- 用例目录增量迁移：仅新增表和字段，不会影响历史用例数据。
CREATE TABLE `case_directories` (
  `id` VARCHAR(64) NOT NULL,
  `project_id` VARCHAR(64) NOT NULL,
  `parent_id` VARCHAR(64) DEFAULT NULL,
  `name` VARCHAR(128) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_project_id` (`project_id`),
  INDEX `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试用例目录';

ALTER TABLE `test_cases`
  ADD COLUMN `directory_id` VARCHAR(64) DEFAULT NULL COMMENT '所属用例目录ID',
  ADD INDEX `idx_directory_id` (`directory_id`);
