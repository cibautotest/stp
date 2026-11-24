-- 登录方式复用：新增登录方式表 + 用例关联字段（仅新增，不影响历史数据）
CREATE TABLE IF NOT EXISTS `login_methods` (
  `id` VARCHAR(64) NOT NULL,
  `project_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL COMMENT '登录方式名称',
  `type` VARCHAR(16) NOT NULL COMMENT '类型: none(免登录)/cas(CAS登录)/local(本地登录)',
  `login_url` VARCHAR(512) DEFAULT NULL COMMENT '登录页地址',
  `role_name` VARCHAR(64) DEFAULT NULL COMMENT '角色名（如 管理员/普通用户）',
  `username` VARCHAR(128) DEFAULT NULL COMMENT '账号',
  `password` VARCHAR(256) DEFAULT NULL COMMENT '密码（加密存储）',
  `steps_nlp` MEDIUMTEXT COMMENT '登录补充步骤 NLP（图形验证码/弹窗处理等）',
  `yaml_script` MEDIUMTEXT COMMENT '生成的登录 YAML 脚本',
  `cache_status` VARCHAR(16) NOT NULL DEFAULT 'uncached' COMMENT '缓存状态: uncached/cached',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  INDEX `idx_project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目登录方式';

ALTER TABLE `test_cases`
  ADD COLUMN `login_method_id` VARCHAR(64) DEFAULT NULL COMMENT '关联登录方式ID' AFTER `directory_id`,
  ADD INDEX `idx_login_method_id` (`login_method_id`);
