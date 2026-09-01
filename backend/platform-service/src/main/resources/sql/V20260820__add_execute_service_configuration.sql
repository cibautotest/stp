-- 执行机配置增量迁移
-- 适用于已有历史数据的数据库；仅新增列，不会删表、重建表或修改历史数据。

ALTER TABLE `projects`
  ADD COLUMN `execute_service_url` VARCHAR(512) DEFAULT NULL COMMENT '项目默认执行机服务地址';

ALTER TABLE `users`
  ADD COLUMN `execute_service_url` VARCHAR(512) DEFAULT NULL COMMENT '用户专属执行机服务地址';

ALTER TABLE `execution_record`
  ADD COLUMN `execute_service_url` VARCHAR(512) DEFAULT NULL COMMENT '本次执行实际使用的执行机服务地址';
