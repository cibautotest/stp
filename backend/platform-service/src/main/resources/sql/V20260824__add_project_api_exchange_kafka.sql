ALTER TABLE `projects`
  ADD COLUMN `api_exchange_kafka_enabled` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether to publish captured browser request/response exchanges to Kafka';
