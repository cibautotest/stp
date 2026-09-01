ALTER TABLE `projects`
  ADD COLUMN `traffic_tagging_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否注入执行端 SW8/流量染色请求头';
