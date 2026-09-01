## Context

### 背景

当前权限模型：
- **sysadmin**: 通过角色绕过所有权限过滤，可见所有项目
- **general**: 只能看到 `user_projects` 表中显式分配的项目

创建项目的流程缺少自动权限分配：
```
用户创建项目 → projects 表写入 → user_projects 未写入 → 用户看不到项目
```

### 约束条件

- 不改变 sysadmin 的行为（已有完整权限）
- 不引入新的角色或权限表
- 保持与现有权限过滤逻辑兼容
- 数据库变更需要向后兼容

## Goals / Non-Goals

**Goals:**
- Project 实体增加 `created_by` 字段记录创建者
- 创建项目时自动将创建者加入 `user_projects`
- Controller 层获取当前用户信息传入 Service

**Non-Goals:**
- 不修改前端代码
- 不修改权限过滤逻辑
- 不引入项目内角色

## Architecture

### 数据流

```
用户发起 POST /api/platform/projects
       │
       ▼
ProjectController.create(project, Authentication)
       │
       ├─ 提取 userId, role
       │
       ▼
ProjectService.create(project, userId)
       │
       ├── 1. 保存 project 到 projects 表
       │      └─ project.setCreatedBy(userId)
       │
       ├── 2. 插入 user_projects (userId, projectId)
       │      └─ 自动授予创建者访问权限
       │
       └── 3. 返回创建结果
```

### 数据库变更

```sql
-- projects 表增加 created_by 字段
ALTER TABLE projects ADD COLUMN `created_by` BIGINT(20) DEFAULT NULL COMMENT '创建人用户ID' AFTER `description`;
ALTER TABLE projects ADD INDEX `idx_created_by` (`created_by`);
```

### 后端变更

| 文件 | 变更内容 |
|------|----------|
| `Project.java` | 增加 `createdBy` 字段 |
| `ProjectController.java` | `create()` 方法增加 `Authentication` 参数 |
| `ProjectService.java` | 新增 `create(Project, Long userId)` 方法，保存后自动插入 `user_projects` |
| `UserService.java` | 新增 `assignProjectToUser(Long userId, String projectId)` 方法 |

## Migration

### 升级步骤

1. 执行 ALTER TABLE 添加 `created_by` 字段
2. 部署更新后的 platform-service
3. 新建的项目自动带有创建者归属

### 回滚方案

1. 回退 platform-service 到旧版本
2. 可选执行 `ALTER TABLE projects DROP COLUMN created_by`
