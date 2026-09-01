ALTER TABLE `api_exchange`
  DROP INDEX `uk_api_exchange_request`,
  ADD UNIQUE KEY `uk_api_exchange_execution_request` (`execution_id`, `request_id`);
