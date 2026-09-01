## Why

当前系统中，普通用户创建项目后，**无法立即看到自己创建的项目**。因为 `projects` 表中没有记录创建者信息，`user_projects` 关联表中也不会自动插入记录。用户必须等待管理员在用户管理页面手动分配项目权限后才能访问。

这不仅影响用户体验，也增加了管理员的手动操作负担。

## What Changes

### 1. Project 实体增加 `created_by` 字段

记录项目的创建者用户 ID，方便追溯归属和权限控制。

### 2. 创建项目时自动授予权限

当用户创建项目时，系统自动在 `user_projects` 表中插入一条记录，将创建者与该项目关联。sysadmin 角色不受此限制（已通过角色绕过所有权限过滤）。

### 3. Controller 获取当前用户上下文

`ProjectController.create()` 方法需要注入 `Authentication` 参数，获取当前登录用户的信息，传递给 Service 层。

## Capabilities

- **user-project-auto-permission**: 项目创建时自动授予创建者访问权限
- **project-owner-tracking**: 记录项目创建者信息

## Non-Goals

- 不引入项目内角色（如 owner/member/viewer）的细粒度权限模型
- 不改动已有的权限过滤逻辑（sysadmin 仍然可见所有项目）
- 不增加前端改动
