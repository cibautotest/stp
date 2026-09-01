---
name: update-db-name-to-uitest
overview: 将项目中的数据库名从 cibtest 更新为 uitest，涉及 init.sql 和 docker-compose.yml 两个文件
todos:
  - id: fix-init-sql
    content: 将 init.sql 中第3行注释和第7行 USE 语句的 cibtest 替换为 uitest
    status: pending
  - id: fix-docker-compose
    content: 将 docker-compose.yml 第77行 SPRING_DATASOURCE_URL 中的 cibtest 替换为 uitest
    status: pending
  - id: verify-consistency
    content: 全局搜索确认无其他 cibtest 残留引用
    status: pending
    dependencies:
      - fix-init-sql
      - fix-docker-compose
---

## 需求

将项目中残留的旧数据库名 cibtest 更新为 uitest，确保项目配置与远程数据库 `jdbc:mysql://39.108.223.116:3306/uitest` 一致。

## 背景

application.yml 已在之前更新为 uitest，但以下两处仍残留 cibtest：

- `backend/platform-service/src/main/resources/sql/init.sql` — 注释行和 USE 语句
- `docker/docker-compose.yml` — Platform 服务的 SPRING_DATASOURCE_URL 环境变量

## 技术方案

纯文本替换，3 处精确修改，无代码逻辑变更。

### 修改清单

| 文件 | 行号 | 旧值 | 新值 |
| --- | --- | --- | --- |
| init.sql | 3 | `cibtest` (注释) | `uitest` |
| init.sql | 7 | `USE cibtest;` | `USE uitest;` |
| docker-compose.yml | 77 | `/cibtest?` | `/uitest?` |