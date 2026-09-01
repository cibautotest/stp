## Context

### 背景

当前系统管理测试用例的方式是"用例中心"模式，缺少"测试计划"这一组织维度。用户每次需要执行一组用例时都要重新勾选。

### 约束条件
- 遵循现有后端 CRUD 模式（MyBatis-Plus + ServiceImpl + Controller）
- 遵循现有前端模式（Vue 3 + Element Plus + Pinia + Axios）
- 测试计划归属于项目（一个项目多个计划），不跨项目
- 计划内的用例必须是同一项目下的（创建时确定项目）
- 权限模型沿用现有规则（sysadmin 可见全部，general 只能看到自己有权限的项目）

## Goals / Non-Goals

**Goals:**
- 完整的测试计划 CRUD（后端 + 前端）
- 批量勾选用例后一键保存为测试计划
- 测试计划展开后可管理内部用例（新增/删除）
- 左侧导航增加"测试计划"入口

**Non-Goals:**
- 按计划批量执行（后续扩展）
- 计划定时触发
- 跨项目计划
- 计划版本管理

## Architecture

### 数据库模型

```sql
-- 测试计划表
CREATE TABLE IF NOT EXISTS `test_plans` (
  `id`          VARCHAR(64)  NOT NULL COMMENT '计划ID (UUID)',
  `project_id`  VARCHAR(64)  NOT NULL COMMENT '所属项目ID',
  `name`        VARCHAR(128) NOT NULL COMMENT '计划名称',
  `description` VARCHAR(512) DEFAULT '' COMMENT '计划描述',
  `status`      VARCHAR(32)  NOT NULL DEFAULT 'ACTIVE' COMMENT '状态: ACTIVE/ARCHIVED',
  `created_by`  BIGINT(20)   DEFAULT NULL COMMENT '创建人用户ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  INDEX `idx_project_id` (`project_id`),
  INDEX `idx_created_by` (`created_by`),
  CONSTRAINT `fk_plan_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='测试计划表';

-- 计划-用例关联表
CREATE TABLE IF NOT EXISTS `test_plan_cases` (
  `id`          BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `plan_id`     VARCHAR(64)  NOT NULL COMMENT '计划ID',
  `case_id`     VARCHAR(64)  NOT NULL COMMENT '用例ID',
  `sort_order`  INT(11)      NOT NULL DEFAULT 0 COMMENT '排序序号',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_plan_case` (`plan_id`, `case_id`),
  INDEX `idx_plan_id` (`plan_id`),
  INDEX `idx_case_id` (`case_id`),
  CONSTRAINT `fk_tpc_plan` FOREIGN KEY (`plan_id`) REFERENCES `test_plans`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tpc_case` FOREIGN KEY (`case_id`) REFERENCES `test_cases`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='计划-用例关联表';
```

### 用户交互流程

```
【流程一】从用例管理页创建测试计划
  用例管理页
    ├─ 1. 项目下拉筛选 → 选择项目
    ├─ 2. 勾选用例（多选）
    ├─ 3. 点击工具栏「保存为测试计划」按钮
    ▼
  弹出对话框 → 输入计划名称 + 可选描述 → 确认
    ▼
  后端创建 test_plans 记录 + test_plan_cases 关联记录
    ▼
  提示成功 → 停留在用例管理页

【流程二】在测试计划页管理计划
  测试计划页
    ├─ 按项目分组显示所有计划
    │   项目 A
    │     ├─ 回归测试计划  [编辑] [删除]
    │     │    ├─ 登录测试        [从计划移除]
    │     │    ├─ 下单测试        [从计划移除]
    │     │    └─ [+ 添加用例] → 弹窗选择该项目下的用例
    │     └─ 冒烟测试计划  [编辑] [删除]
    └─ [新建计划] 按钮 → 弹窗（选项目 + 输入名称 + 选用例）
```

### 后端新增文件

| 文件 | 说明 |
|------|------|
| `entity/TestPlan.java` | 测试计划实体 |
| `entity/TestPlanCase.java` | 计划-用例关联实体 |
| `mapper/TestPlanMapper.java` | Mapper |
| `mapper/TestPlanCaseMapper.java` | Mapper |
| `service/TestPlanService.java` | 业务逻辑（含权限过滤） |
| `controller/TestPlanController.java` | REST 端点 |

### 后端 API

```
# 测试计划 CRUD
GET    /api/platform/plans?projectId=xxx           # 获取计划列表
GET    /api/platform/plans/{id}                     # 获取计划详情
POST   /api/platform/plans                          # 创建计划（含关联用例）
PUT    /api/platform/plans/{id}                     # 更新计划
DELETE /api/platform/plans/{id}                     # 删除计划

# 计划内用例管理
GET    /api/platform/plans/{id}/cases               # 获取计划内用例
POST   /api/platform/plans/{id}/cases               # 添加用例 { caseIds: [...] }
DELETE /api/platform/plans/{id}/cases/{caseId}      # 移除某个用例
```

### 前端新增/修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `api/plans.ts` | 新建 | 测试计划 API 模块 |
| `api/index.ts` | 修改 | 添加 plans 导出 |
| `stores/plans.ts` | 新建 | Pinia Store |
| `stores/index.ts` | 修改 | 添加 usePlanStore 导出 |
| `views/cases/index.vue` | 修改 | 工具栏新增"保存为测试计划"按钮 |
| `views/plans/index.vue` | 新建 | 测试计划管理主页面 |
| `router/index.ts` | 修改 | 新增 `/plans` 路由 |
| `layout/MainLayout.vue` | 修改 | 新增菜单项 |

### 用例管理页工具栏变更

```
修改前: [项目筛选]  [批量删除(N)]          [新建] [刷新]
修改后: [项目筛选]  [保存为测试计划(N)]  [批量删除(N)]  [新建] [刷新]
                               ↑ 仅当有选中用例且已选项目时启用
```

### 测试计划页布局示意

```
┌──────────────────────────────────────────────────────────┐
│  测试计划                                    [新建计划]   │
├──────────────────────────────────────────────────────────┤
│  项目筛选: [电商平台测试 ▾]                               │
│                                                          │
│  ┌─ 回归测试计划 ───────────────────── [编辑] [删除] ──┐ │
│  │  ├─ ☐ 登录功能测试            [移除]                │ │
│  │  ├─ ☐ 商品搜索测试            [移除]                │ │
│  │  ├─ ☐ 下单流程测试            [移除]                │ │
│  │  └─ [+ 添加用例]                                   │ │
│  └──────────────────────────────────────────────────────│ │
│                                                          │
│  ┌─ 冒烟测试计划 ───────────────────── [编辑] [删除] ──┐ │
│  │  ├─ ☐ 登录功能测试            [移除]                │ │
│  │  └─ [+ 添加用例]                                   │ │
│  └──────────────────────────────────────────────────────│ │
└──────────────────────────────────────────────────────────┘
```

## Migration

### 升级步骤
1. 执行 DDL 创建 `test_plans` 和 `test_plan_cases` 表
2. 部署更新后的 platform-service
3. 前端的修改自动生效

### 回滚方案
1. 回退 platform-service 到旧版本
2. 回退前端到旧版本
3. 可选删除两张表

## Open Questions
1. 添加用例到计划时只展示当前项目下的用例 → **是**
2. 创建计划时是否必须同时选择用例 → **是**（从批量选择触发）
3. 删除计划时是否删除关联关系 → **是**（外键 CASCADE 自动删除）
