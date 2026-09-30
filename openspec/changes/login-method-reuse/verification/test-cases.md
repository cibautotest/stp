# 验收用例清单 — login-method-reuse

## API 级用例（已执行）

| # | 用例 | 步骤 | 预期 | 结果 |
|---|------|------|------|------|
| A1 | 创建登录方式 | POST /api/platform/login-methods（type=cas，含 [动态] 补充步骤） | 201，返回 id，cacheStatus=uncached | ✅ |
| A2 | 登录方式列表 | GET /api/platform/login-methods?projectId=xxx | 列表含新记录 | ✅ |
| A3 | 缓存状态回调（免鉴权） | PUT /api/platform/login-methods/{id}/cache-status {"status":"cached"} | 200 ok:true，再查列表 cacheStatus=cached | ✅ |
| A4 | 删除登录方式 | DELETE /api/platform/login-methods/{id} | 探测数据清理成功 | ✅ |
| A5 | 用例执行-登录阶段 | 直连 POST :3001/execute/async 带 loginMethod（cas） | 登录阶段执行→业务步骤执行 | ✅（修复 aiWaitFor 后通过） |
| A6 | 执行机地址解析 | sysadmin 触发 POST /execute/cases/{id} | 任务入队（执行机地址须可达） | ✅ |

## 单元测试（代码位置）

| 层 | 文件 | 用例数 | 覆盖点 |
|----|------|--------|--------|
| 后端 | backend/platform-service/src/test/java/.../CaseExecutionServiceTest.java | 7 | stripLoginTask（剔除登录 task/单 task 保护/空输入）、extractWebUrl |
| 引擎 | execute-service/tests/yaml-runner.test.ts | 6 | buildLoginYaml（模板/[动态]→cacheable:false/单引号转义/yamlScript 优先）、urlsEqual |
| 前端 | frontend/src/utils/index.test.ts | 9 | formatDuration/formatDate/deepClone/debounce/throttle |

## 端到端用例（待用户验收）

| # | 用例 | 预期 |
|---|------|------|
| E1 | 创建页选 CAS → 新建登录账号（4 项+动态值补充步骤）→ 确认保存 | 落库并自动选中，角色名=账号 |
| E2 | 生成脚本 | 对话框 NLP 首行为登录 NLP，YAML 含「登录」task，动态步骤 cacheable:false |
| E3 | 创建并执行（两次） | 首次生成登录缓存；二次登录阶段命中缓存提速；浏览器不中断 |
| E4 | 用例管理执行已保存用例 | 注入 loginMethod，先登录后业务（不空白页） |
| E5 | 插件导出弹窗 | 登录方式选择/新建，同步用例带 loginMethodId |
