-- Apply this after V20260822__add_api_exchange.sql when that table already exists.
ALTER TABLE `api_exchange`
  ADD COLUMN `request_headers` MEDIUMTEXT DEFAULT NULL AFTER `content_type`,
  ADD COLUMN `request_body_base64` MEDIUMTEXT DEFAULT NULL AFTER `request_headers`,
  ADD COLUMN `request_body_truncated` TINYINT(1) NOT NULL DEFAULT 0 AFTER `request_body_base64`,
  ADD COLUMN `response_headers` MEDIUMTEXT DEFAULT NULL AFTER `request_body_truncated`,
  ADD COLUMN `response_body_base64` MEDIUMTEXT DEFAULT NULL AFTER `response_headers`,
  ADD COLUMN `response_body_truncated` TINYINT(1) NOT NULL DEFAULT 0 AFTER `response_body_base64`;
