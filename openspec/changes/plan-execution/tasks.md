## 1. 数据库变更

- [ ] 1.1 test_plans 表新增 last_executed_at、last_execution_result、last_batch_id 列（ALTER TABLE DDL）
- [ ] 1.2 更新 init.sql 全量建表语句，加入新列定义

## 2. 后端 — Entity & Mapper

- [ ] 2.1 TestPlan Entity 新增 lastExecutedAt、lastExecutionResult、lastBatchId 字段（@TableField 映射）
- [ ] 2.2 TestPlanMapper 无需改动（MyBatis-Plus 自动映射新字段）
- [ ] 2.3 新增 TestPlanCaseMapper 方法：按 planId + sort_order 升序查询 caseIds

## 3. 后端 — PlanExecutionService 串行执行核心

- [ ] 3.1 新建 PlanExecutionService，注入 TestPlanService、CaseExecutionService、BatchExecutionService、TestPlanCaseMapper
- [ ] 3.2 实现 @Async executePlanAsync(planId, batchId)：按 sort_order 遍历 caseIds，逐个执行并轮询等待
- [ ] 3.3 实现单个用例执行逻辑：检查 yaml_flow/script 是否存在 → 调用 caseExecutionService.execute() → 轮询 execution_record 直到 SUCCESS/FAILED
- [ ] 3.4 实现轮询机制：每 2s 查 execution_record.status，单用例最大等待 10 分钟超时
- [ ] 3.5 全部用例完成后：调用 batchExecutionService.checkAndMergeBatch(batchId) 触发合并报告
- [ ] 3.6 更新 test_plans 执行历史：last_executed_at、last_execution_result（根据失败计数）、last_batch_id
- [ ] 3.7 配置 Spring @EnableAsync（如尚未启用）

## 4. 后端 — Controller 端点

- [ ] 4.1 TestPlanController 新增 POST /{id}/execute 端点
- [ ] 4.2 验证逻辑：计划存在、计划中有用例、计划不在执行中（last_batch_id 仍有 RUNNING 记录）
- [ ] 4.3 生成 batchId，调用 PlanExecutionService.executePlanAsync()，返回 202 { batchId, totalCases }

## 5. 前端 — API & Store

- [ ] 5.1 api/plans.ts 新增 executePlan(planId) 接口调用 POST /api/platform/plans/{id}/execute
- [ ] 5.2 stores/plans.ts 新增 executePlan action，管理执行中状态
- [ ] 5.3 types/index.ts 新增 TestPlan 的 lastExecutedAt、lastExecutionResult、lastBatchId 字段

## 6. 前端 — 计划页面 UI

- [ ] 6.1 计划卡片 plan-header 右侧新增"执行"按钮（el-button + VideoPlay 图标）
- [ ] 6.2 点击执行时：判断计划是否有用例 → 调 API → 弹出 BatchProgressDialog
- [ ] 6.3 执行中状态管理：记录 executingBatchId，相应的计划"执行"按钮 disabled 显示"执行中"
- [ ] 6.4 计划卡片展示执行历史：根据 last_execution_result 显示对应状态标签（PASSED=绿色/FAILED=红色/N_FAILED=橙色），并显示执行时间
- [ ] 6.5 关闭 BatchProgressDialog 或执行完成后，刷新计划列表数据

## 7. 集成验证

- [ ] 7.1 端到端测试：创建含 2 个用例的计划 → 点击执行 → 确认按 sort_order 串行完成 → 查看合并报告
- [ ] 7.2 边界测试：空的计划点执行应提示错误、正在执行中的计划不可重复执行
- [ ] 7.3 回归验证：现有的单个用例执行、批量执行不受影响
