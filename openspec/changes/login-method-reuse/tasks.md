# 实施任务清单

## DB 与后端

- [x] 1. SQL 迁移：`login_methods` 表 + `test_cases.login_method_id`（V20260904__add_login_methods.sql）
- [x] 2. `LoginMethod` 实体 + `LoginMethodService` + `LoginMethodController`（CRUD，按 projectId 列表）
- [x] 3. `CreateAndExecuteRequest` + `CreateAndExecuteService`：loginMethodId 透传（存量为空按免登录兼容）；`ExecuteRequest` 加 loginMethod 负载
- [x] 4. 缓存状态回调接口：`PUT /api/platform/login-methods/{id}/cache-status`（SecurityConfig 白名单放行，实测 uncached→cached 更新成功）

## 执行引擎

- [x] 5. `yaml-runner.ts`：登录阶段（type!=none 时独立 cache id `login_{id}` 执行，generateReport:false）→ 同一 page 执行用例主体；成功后回调 cache_status（tsc 编译通过）
- [x] 6. 登录 YAML 生成：优先用 yaml_script，无则按 loginUrl/username/password/stepsNlp 模板拼接（[动态] 行自动加 cacheable: false）

## 前端（创建用例页）

- [x] 7. 登录方式区块：三类型单选 + 角色下拉（含新建角色表单）+ 缓存标记 + 上次角色记忆 + 必选校验
- [x] 8. 登录方式管理 API 接入（cases.ts + stores/cases.ts 透传 loginMethodId）

## 插件

- [x] 9. 导出弹窗登录方式区块（类型单选/角色下拉/缓存提示/新建角色）+ 同步传 loginMethodId

## Prompt 与验收

- [x] 10. YamlGeneratorService system prompt 加 cacheable 规则（[动态] 规范，YAML_SYSTEM_PROMPT 常量统一两处）
- [x] 11. 编译验证通过（backend mvn EXIT 0；execute-service tsc EXIT 0；前端 lint 零错误）；登录方式 API 端到端实测通过（创建 201/列表/缓存回调）
- [ ] 12. 端到端验收（用户）：创建登录方式 → 建用例绑定 → 两次执行验证缓存提速与浏览器连续性
