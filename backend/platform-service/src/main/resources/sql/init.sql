-- ============================================
-- 智能测试中台 - 数据库初始化脚本
-- 数据库: 39.108.223.116:3306/uitest
-- 注意: 数据库已存在，仅建表
-- ============================================

USE uitest;

-- -------------------------------------------
-- 项目管理表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS `projects` (
  `traffic_tagging_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'traffic tagging switch',
  `skywalking_graphql_url` VARCHAR(512) DEFAULT NULL COMMENT 'project SkyWalking GraphQL endpoint',
  `api_exchange_kafka_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'api exchange kafka switch',
  `id`          VARCHAR(64)  NOT NULL COMMENT '项目ID (UUID)',
  `name`        VARCHAR(128) NOT NULL COMMENT '项目名称',
  `description` VARCHAR(512) DEFAULT '' COMMENT '项目描述',
  `created_by`  BIGINT(20)   DEFAULT NULL COMMENT '创建人用户ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除标记 0-未删除 1-已删除',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目管理表';

-- -------------------------------------------
-- 测试用例表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS `test_cases` (
  `id`                  VARCHAR(64)  NOT NULL COMMENT '用例ID (UUID)',
  `project_id`          VARCHAR(64)  NOT NULL COMMENT '所属项目ID',
  `name`                VARCHAR(255) NOT NULL DEFAULT '' COMMENT '用例名称',
  `description`         TEXT                  COMMENT '用例描述（业务含义）',
  `nlp`                 TEXT         NOT NULL COMMENT '自然语言测试步骤',
  `yaml_flow`           TEXT                  COMMENT '生成的 YAML 任务流',
  `execution_mode`      VARCHAR(16)  NOT NULL DEFAULT 'NLP' COMMENT '默认执行方式：NLP 或 YAML',
  `script`              LONGTEXT              COMMENT '生成的 TypeScript 执行脚本',
  `url`                 VARCHAR(512)          COMMENT '目标页面 URL',
  `status`              VARCHAR(32)  NOT NULL DEFAULT 'PENDING' COMMENT '用例状态: PENDING/RUNNING/SUCCESS/FAILED',
  `ai_config_snapshot`  TEXT                  COMMENT '执行时的 AI 配置快照 (JSON)',
  `executed_at`         DATETIME              COMMENT '最近执行时间',
  `report_generated_at` DATETIME              COMMENT '报告生成时间',
  `html_report_path`    VARCHAR(512)          COMMENT 'HTML 报告路径',
  `full_report_path`    VARCHAR(512)          COMMENT '完整报告文件路径',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`             TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  INDEX `idx_project_id` (`project_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试用例表';

-- -------------------------------------------
-- AI 配置表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS `ai_config` (
  `id`               BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '配置ID',
  `base_url`         VARCHAR(256) NOT NULL DEFAULT 'https://dashscope.aliyuncs.com/compatible-mode/v1' COMMENT 'Midscene 模型 API 地址',
  `api_key`          VARCHAR(256) NOT NULL DEFAULT '' COMMENT 'API Key',
  `model_name`       VARCHAR(128) NOT NULL DEFAULT 'qwen3-vl-plus' COMMENT '模型名称',
  `model_family`     VARCHAR(64)  NOT NULL DEFAULT 'qwen3-vl' COMMENT '模型家族',
  `browser_headless` TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否使用 Headless 模式 0-否 1-是',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI 配置表';

-- -------------------------------------------
-- 测试报告表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS `reports` (
  `id`                  BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '报告ID',
  `case_id`             VARCHAR(64)  NOT NULL COMMENT '关联用例ID',
  `batch_id`            VARCHAR(128) DEFAULT NULL COMMENT '批次ID（批量执行关联）',
  `type`                VARCHAR(32)  NOT NULL DEFAULT 'SINGLE' COMMENT '报告类型: SINGLE/BATCH',
  `name`                VARCHAR(255) NOT NULL DEFAULT '' COMMENT '报告名称',
  `project_id`          VARCHAR(64)  DEFAULT NULL COMMENT '所属项目ID',
  `status`              VARCHAR(32)  NOT NULL COMMENT '执行状态: SUCCESS/FAILED',
  `duration`            BIGINT(20)   DEFAULT 0 COMMENT '执行时长(毫秒)',
  `nlp`                 TEXT                  COMMENT '执行时的 NLP 指令',
  `url`                 VARCHAR(512)          COMMENT '目标 URL',
  `yaml_flow`           TEXT                  COMMENT '任务流 YAML',
  `result`              TEXT                  COMMENT '执行结果 (JSON)',
  `error`               TEXT                  COMMENT '错误信息',
  `logs`                MEDIUMTEXT            COMMENT '执行日志 (JSON Array)',
  `merged_report_path`  VARCHAR(512) DEFAULT NULL COMMENT '合并报告文件路径（BATCH类型）',
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '报告生成时间',
  PRIMARY KEY (`id`),
  INDEX `idx_case_id` (`case_id`),
  INDEX `idx_batch_id` (`batch_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_project_id` (`project_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试报告表';

-- -------------------------------------------
-- 报告表迁移: 为已有数据回填 name 和 project_id
-- -------------------------------------------
-- UPDATE reports r
--   INNER JOIN test_cases tc ON r.case_id = tc.id
--   SET r.name = tc.name,
--       r.project_id = tc.project_id
--   WHERE r.name = '' OR r.project_id IS NULL;

-- -------------------------------------------
-- 执行记录表
-- -------------------------------------------
CREATE TABLE IF NOT EXISTS `execution_record` (
  `id`           BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `case_id`      VARCHAR(64)  NOT NULL COMMENT '关联用例ID',
  `batch_id`     VARCHAR(128) DEFAULT NULL COMMENT '批次ID（批量执行时关联）',
  `execution_id` VARCHAR(128) NOT NULL COMMENT 'Execute Service 返回的 executionId',
  `status`       VARCHAR(32)  NOT NULL DEFAULT 'RUNNING' COMMENT '执行状态: PENDING/RUNNING/SUCCESS/FAILED',
  `duration`     BIGINT(20)   DEFAULT NULL COMMENT '执行耗时（毫秒）',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_execution_id` (`execution_id`),
  INDEX `idx_case_id` (`case_id`),
  INDEX `idx_batch_id` (`batch_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行记录表';

-- ============================================
-- 用户表 (变更: 2026-05-21 - 新增用户系统)
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username`      VARCHAR(64)  NOT NULL COMMENT '用户名 (唯一)',
  `password`      VARCHAR(256) NOT NULL COMMENT '密码 (BCrypt 加密)',
  `display_name`  VARCHAR(128) DEFAULT '' COMMENT '显示名称',
  `role`          VARCHAR(32)  NOT NULL DEFAULT 'general' COMMENT '角色: sysadmin / general',
  `status`        TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `last_login_at` DATETIME              COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

-- ============================================
-- 用户-项目关联表 (变更: 2026-05-21 - 新增用户项目权限)
-- ============================================
CREATE TABLE IF NOT EXISTS `user_projects` (
  `id`          BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id`     BIGINT(20)   NOT NULL COMMENT '用户ID',
  `project_id`  VARCHAR(64)  NOT NULL COMMENT '项目ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_project` (`user_id`, `project_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-项目关联表';

-- ============================================
-- Default bootstrap administrator for fresh installs.
-- Username: sysadmin
-- Password: admin123
INSERT IGNORE INTO `users` (
  `username`,
  `password`,
  `display_name`,
  `role`,
  `status`
) VALUES (
  'sysadmin',
  '$2a$10$ocZpUZ0zcXw5LCgyx.q4herCerdUA2pBu41oDo02Bi/EBZ0Xvpz6.',
  '系统管理员',
  'sysadmin',
  1
);

-- ============================================
-- 测试计划表 (变更: 2026-05-21 - 新增测试计划模块)
-- ============================================
CREATE TABLE IF NOT EXISTS `test_plans` (
  `id`          VARCHAR(64)  NOT NULL COMMENT '计划ID (UUID)',
  `project_id`  VARCHAR(64)  NOT NULL COMMENT '所属项目ID',
  `name`        VARCHAR(128) NOT NULL COMMENT '计划名称',
  `description` VARCHAR(512) DEFAULT '' COMMENT '计划描述',
  `status`      VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/ARCHIVED',
  `created_by`  BIGINT(20)   DEFAULT NULL COMMENT '创建人用户ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`               TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  `last_executed_at`      DATETIME              COMMENT '上次执行时间',
  `last_execution_result` VARCHAR(64)  DEFAULT NULL COMMENT '上次执行结果: PASSED/FAILED/N_FAILED',
  `last_batch_id`         VARCHAR(128) DEFAULT NULL COMMENT '上次执行批次ID',
  PRIMARY KEY (`id`),
  INDEX `idx_project_id` (`project_id`),
  INDEX `idx_created_by` (`created_by`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试计划表';

-- ============================================
-- 计划-用例关联表 (变更: 2026-05-21 - 新增测试计划模块)
-- ============================================
CREATE TABLE IF NOT EXISTS `test_plan_cases` (
  `id`          BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `plan_id`     VARCHAR(64)  NOT NULL COMMENT '计划ID',
  `case_id`     VARCHAR(64)  NOT NULL COMMENT '用例ID',
  `sort_order`  INT(11)      NOT NULL DEFAULT 0 COMMENT '排序序号',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_plan_case` (`plan_id`, `case_id`),
  INDEX `idx_plan_id` (`plan_id`),
  INDEX `idx_case_id` (`case_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计划-用例关联表';

-- ============================================
-- 变更: 2026-05-26 - 计划执行历史字段 (plan-execution)
-- ============================================
-- 注意: MySQL 不支持 ADD COLUMN IF NOT EXISTS，如执行报错请跳过
-- ALTER TABLE `test_plans`
--   ADD COLUMN `last_executed_at`      DATETIME              COMMENT '上次执行时间',
--   ADD COLUMN `last_execution_result` VARCHAR(64)  DEFAULT NULL COMMENT '上次执行结果: PASSED/FAILED/N_FAILED',
--   ADD COLUMN `last_batch_id`         VARCHAR(128) DEFAULT NULL COMMENT '上次执行批次ID';
