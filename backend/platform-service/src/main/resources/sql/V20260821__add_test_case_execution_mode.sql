ALTER TABLE `test_cases`
    ADD COLUMN `execution_mode` VARCHAR(16) NOT NULL DEFAULT 'NLP' COMMENT '默认执行方式：NLP 或 YAML';
