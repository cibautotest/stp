# 实施任务

## 1. 数据库变更

- [ ] 1.1 在 `projects` 表增加 `created_by` 字段
  - 执行 DDL: `ALTER TABLE projects ADD COLUMN created_by BIGINT(20) DEFAULT NULL COMMENT '创建人用户ID' AFTER description;`
  - 语句位置: `backend/platform-service/src/main/resources/sql/init.sql`

## 2. 后端代码修改

- [ ] 2.1 Project 实体增加 `createdBy` 字段
  - 文件: `backend/platform-service/src/main/java/com/smarttesting/platform/entity/Project.java`
  - 添加: `private Long createdBy;`
  - 添加 getter/setter

- [ ] 2.2 ProjectController.create() 注入 Authentication
  - 文件: `backend/platform-service/src/main/java/com/smarttesting/platform/controller/ProjectController.java`
  - 方法签名增加 `Authentication authentication` 参数
  - 提取 userId 传给 service

- [ ] 2.3 UserService 新增单项目分配方法
  - 文件: `backend/platform-service/src/main/java/com/smarttesting/platform/service/UserService.java`
  - 新增 `assignProjectToUser(Long userId, String projectId)` 方法

- [ ] 2.4 ProjectService 新增创建方法
  - 文件: `backend/platform-service/src/main/java/com/smarttesting/platform/service/ProjectService.java`
  - 新增 `create(Project project, Long userId)` 方法
  - 保存 project 后自动插入 user_projects

## 3. 配置文档同步

- [ ] 3.1 更新 openspec.yaml 中 Project 数据模型
  - 增加 `created_by` 字段定义

## 4. 验证

- [ ] 4.1 运行 `mvn compile` 确认编译通过
