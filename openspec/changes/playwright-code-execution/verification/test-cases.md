# 验收用例清单：playwright-code-execution

> 单测代码位置：后端 `backend/platform-service/src/test/`（JUnit5+Mockito）、执行引擎 `execute-service/src/test/`（Vitest）、前端 `frontend/src/**/__tests__/`（Vitest）。
> 实测证据与结论待实施后填写 `evidence.md` / `report.md`。

## 一、单元测试（red-green）

| # | 用例 | 覆盖点 | 位置 |
|---|---|---|---|
| U1 | 动作映射表翻译：aiTap/aiInput/Sleep/goto/upload/download/assertFile → 对应代码片段 | 纯函数翻译 | execute-service Vitest（recorder） |
| U2 | 复杂断言/aiWaitFor/`[动态]`步骤 → @ai 步骤，不产确定性代码 | 降级规则 | 同上 |
| U3 | selector 优先级链生成与降级（elementFromPoint 反查失败 → 缓存 xpath 兜底） | selector 升级器 | 同上 |
| U4 | stp 包装函数：selector 链依序尝试、全失败抛兜底事件 | CODE runner | execute-service Vitest |
| U5 | 脚本注入执行：语法错误 → 明确失败报告数据；取消检查点生效 | vm 执行 | 同上 |
| U6 | script_status 状态机：NONE→RECORDED、变更→STALE、STALE 拒绝 CODE 执行、STALE 拒绝上传覆盖 | 状态机 | backend JUnit |
| U7 | nlp/yaml_flow 变更检测（变更才置 STALE，无关字段变更不置） | 失效触发 | backend JUnit |

## 二、API 实测（PowerShell，中文 body 用 UTF8 字节）

| # | 步骤 | 预期 |
|---|---|---|
| A1 | NLP 执行一个简单用例至成功，轮询执行状态 | SUCCESS 后 `GET /cases/{id}` 返回 script_status=RECORDED、script 非空、script_source_execution_id 非空 |
| A2 | `PUT /internal/scripts/{caseId}` 带 token 上传合法脚本 | 200，状态更新 RECORDED |
| A3 | 同接口对 STALE 用例上传 | 拒绝（409/400 明确语义） |
| A4 | PUT /cases/{id} 修改 nlp | script_status=STALE |
| A5 | 对 STALE/NONE 用例发 CODE 执行请求 | 400，错误信息提示重新录制 |
| A6 | 对 RECORDED 用例发 CODE 执行（`POST /execute/cases/{id}` body executionMode=CODE） | 返回 executionId，状态轮询至 SUCCESS |
| A7 | `GET /cases/{id}/final-script`（CODE 用例） | 响应含 script 内容与模式 CODE |

## 三、端到端（核心链路，按 stp-e2e-verify 流程）

| # | 场景 | 预期 |
|---|---|---|
| E1 | 完整闭环：创建 NLP 用例 → 执行成功 → 详情页见高亮脚本（@ai 标记正确）→ 切 CODE 执行 → 报告中心见 CODE 报告（无 AI 兜底标记、步骤全绿） | 全链路通过 |
| E2 | 兜底链路：录制后人工篡改 script 中某步 selector（经 DB 或接口），CODE 执行 | 该步触发 AI 兜底，执行最终 SUCCESS，报告含"AI兜底"标记与新命中 |
| E3 | 可观测性保留：CODE 执行期间查看 Kafka 报文/`/reports/{executionId}/api-exchanges` | 请求头含 sw8 染色与 x-test-execution-id，报文记录与 NLP 模式一致 |
| E4 | 登录阶段：绑定登录方式的用例 CODE 执行 | 登录阶段走 login 缓存（已缓存秒过），脚本不含凭据，业务段从 targetUrl 继续 |
| E5 | 失效链路：E1 后修改用例 NLP → 详情页 STALE 徽标 → CODE 选项禁用 → 重新 NLP 执行成功 → 恢复 RECORDED | 状态机完整 |
| E6 | 批量/计划混跑：同项目 CODE+NLP 用例批量执行 | 批次正常完成，合并报告正常 |

## 四、回归

| # | 场景 | 预期 |
|---|---|---|
| R1 | 现有 NLP/YAML 执行（含登录方式、缓存、报告）行为不变 | 录制监听零侵入 |
| R2 | 插件导出 → create-and-execute → 录制 → CODE | 插件链路无感兼容 |

## 五、报告幂等（2.10 修复）

| # | 场景 | 预期 |
|---|---|---|
| P1 | 单次执行（任一模式），等待回调 + 至少一个 10s 同步周期后查库 | `reports` 中该 execution_id 仅 1 条记录 |
| P2 | 回调延迟 > 10s 的执行（大报告/脚本上传慢） | 同步先插、回调后到 → 原位更新同一行（id 不变、createdAt 保留） |
| P3 | 单次执行后查 `api_exchange` | report_id 指向该唯一报告行 |
