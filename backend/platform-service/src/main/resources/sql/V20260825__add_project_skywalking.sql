ALTER TABLE `projects`
  ADD COLUMN `skywalking_graphql_url` VARCHAR(512) DEFAULT NULL COMMENT '项目对应的 SkyWalking GraphQL 地址';
