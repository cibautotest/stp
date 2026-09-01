# Spec: 项目创建者权限自动分配

## Requirement: 项目创建者自动获得访问权限

### Description
当用户创建项目时，系统自动将该用户添加为项目的可访问成员，无需管理员手动分配权限。

### Scenarios

**Scenario 1: 普通用户创建项目后自动获得权限**
- Given 用户 A（角色: general）已登录
- When 用户 A 创建项目 "测试项目"
- Then 项目创建成功
- And 用户 A 有权限查看和访问该项目
- And 用户 A 在项目列表中能看到 "测试项目"

**Scenario 2: 管理员创建项目不受影响**
- Given 用户 B（角色: sysadmin）已登录
- When 用户 B 创建项目 "管理项目"
- Then 项目创建成功
- And 用户 B 仍然可以看到所有项目（包括 "管理项目"）

### Acceptance Criteria

1. 创建项目时，projects 表的 created_by 字段正确记录创建者 ID
2. 创建项目时，user_projects 表自动插入一条创建者与该项目的关联记录
3. 普通用户创建项目后刷新列表，立即可见
4. 现有权限过滤逻辑不受影响

### Error Handling

- 如果 user_projects 插入失败（如数据库异常），整个创建事务回滚
- 如果 userId 为 null（未登录用户），跳过自动分配（仅保存项目）
