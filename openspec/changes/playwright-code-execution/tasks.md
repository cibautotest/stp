# 任务清单：playwright-code-execution

> 进度追踪唯一事实源：实施过程中实时勾选 [x]

## 阶段一：执行引擎 — 录制器

- [x] 1.1 新增 `execute-service/src/recorder/types.ts`：录制事件流类型（步骤语义、动作、值、selector 链、xpath 候选、成功标记）
- [x] 1.2 YamlRunner 挂 `onDumpUpdate` 监听：业务阶段 agent 执行时收集每步 Locate 任务元素信息（rect/center/xpath/prompt）
- [x] 1.3 selector 升级器（已完整实施：DumpCollector 持有 page 引用，onDumpUpdate 每步回调时以命中 xpath 反查真实 DOM 元素，注入浏览器的探测函数按 codegen 同款优先级生成升级 selector——`data-testid > id > role+name > placeholder > 短文本`；生成脚本候选链升级 selector 优先、缓存 xpath 兜底；另实现 click+fill 步骤合并）
- [x] 1.4 CodeRecorder 主流程：读取 plan/locate 缓存 + 事件流，按动作映射表（design.md §2.3）翻译生成 TS 脚本字符串；@ai 步骤/动态步骤降级标记；iframe 元素降级 @ai
- [x] 1.5 脚本上传：`PUT /api/platform/internal/scripts/{caseId}?executionId=...`（text/plain + token），仅业务阶段 SUCCESS 后调用；worker 收尾阶段接入
- [ ] 1.6 单元测试（Vitest）：动作映射表纯函数翻译、selector 链生成降级逻辑、动态步骤识别（复用 `hasDynamicContent` 语义）——red-green（用户自行承担测试工作）

## 阶段二：执行引擎 — CODE Runner

- [x] 2.1 `execute-service/src/core/code-runner.ts`：launch/context/page 创建 + `NetworkObserver.install(context)` 复用 + 登录阶段复用 `runLoginStage` + `urlsEqual` 跳过重复导航
- [x] 2.2 stp 包装函数集：click/dblclick/hover/fill/keyboard/ai/aiAssert/aiWaitFor/upload/download/assertFile/evaluate + 取消检查点 + 步骤结果记录
- [x] 2.3 FallbackBridge：Midscene agent 惰性创建（同 caseId 缓存、attach 同一 page）+ `aiXxx(语义注释)` 兜底 + 兜底命中回写缓存路径验证（兜底 agent 与执行共用 cache id，由 Worker 的 uploadCacheIfPresent 回传）
- [x] 2.4 `new Function('stp', script)` 注入执行 + 异常/取消传播（超时由 Worker 层 withTimeout 包裹）
- [x] 2.5 CODE 轻量 HTML 报告生成器（步骤表 + AI 兜底徽标 + 异常步骤截图）
- [x] 2.8 步骤截图可配置（用户需求）：全局 AI 配置新增 codeScreenshotMode（ERROR=仅失败/AI兜底步骤截图，默认；ALL=全步骤截图），链路 ai_config → AiConfigController → ExecuteRequest.screenshotMode → 执行引擎四层透传 → code-runner（screenshotAll 时每步成功路径同步补拍）；前端配置页新增"代码执行截图"下拉（V20261124 迁移）
- [x] 2.9 [排查+修复] CODE 报告接口信息（用户反馈）：实测链路全通（NetworkObserver 采集→Kafka→api_exchange 落库 report_id 关联→查询 API 均正常），缺口在 CODE 轻量报告 HTML 无接口区块——NetworkObserver 新增内存摘要（不依赖 Kafka），CODE 报告嵌入"接口请求"表（方法/URL/状态码/耗时/错误），并引导完整报文去报告中心「接口记录」Tab
- [x] 2.10 [修复] 一次执行生成两份报告（用户反馈 216/217）：回调路径（ExecutionCallbackController）与 10s 定时同步（ExecutionStatusSyncService）对同一执行双插——reports 加 execution_id 列（V20261125 迁移），新建 ExecutionReportService.upsertSingleReport 统一幂等写入（按 execution_id 查重，存在则原位 updateById 保留原 createdAt；统一关联 api_exchange）；两处写入点收敛调用；历史重复数据已清理（迁移 api_exchange.report_id 至保留行 + 回填 execution_id + 删除重复行，原 52 对重复归零）
- [x] 2.6 worker.ts 分发三分支 + orchestrator/queue/schemas/openapi 四层同步（script 字段 + CODE 枚举）
- [ ] 2.7 单元测试（Vitest）：stp 包装函数 selector 链 fallback 顺序、脚本注入执行的语法错误处理、@ai 步骤路由（用户自行承担测试工作）

## 阶段三：平台后端

- [x] 3.1 迁移 SQL `V20261122__add_recorded_script.sql`（script_status / script_source_execution_id / script_recorded_at，已验证无 BOM）
- [x] 3.2 TestCase 实体 + Mapper + `script` 字段启用；script_status 状态机
- [x] 3.3 InternalScriptController：`PUT /internal/scripts/{caseId}`（白名单 + token + 大小上限 `scripts.max-upload-size`（默认 1MB）+ STALE 拒绝覆盖）
- [x] 3.4 ExecuteRequest 加 `script` + @Pattern 扩 CODE；CaseExecutionService.buildExecuteRequest 三分支组装（STALE/NONE 拒绝 CODE 执行）
- [x] 3.5 TestCaseController PUT 变更检测：nlp/yaml_flow 实际变更 → script_status=STALE
- [x] 3.6 用例详情查询/`final-script` 接口响应扩展：script、script_status（TestCase 实体直接返回 + FinalScriptPreview 扩展字段）
- [x] 3.8 [修复] STALE 竞态保护精确化：初版"凡 STALE 一律 409"误杀正常重录流程；新增 `execution_record.dispatched_content_hash`（V20261123 迁移，三个落库点写入），上传时哈希比对区分"下发前置 STALE（放行重录）"与"执行期间被改（拒绝）"；`standardizeBatch` 变更 NLP 时同步置 STALE
- [ ] 3.7 单元测试（JUnit + Mockito）：script_status 状态机、STALE 拒绝执行、变更触发失效（用户自行承担测试工作）

## 阶段四：前端

- [x] 4.1 补依赖 `@codemirror/lang-javascript`；封装只读 CodeMirror TS 高亮组件（one-dark 主题）— `components/code/CodeViewer.vue`
- [x] 4.2 详情页"录制脚本"卡片：CodeMirror 展示 + @ai 步骤标记渲染 + RECORDED/STALE/NONE 状态徽标 + 复制按钮（以对话框形式呈现）
- [x] 4.3 详情页执行模式切换加 CODE（仅 RECORDED 可选，禁用态提示原因）；FinalScriptPreview 对 CODE 模式展示 script
- [x] 4.4 `frontend/src/api/cases.ts`：执行请求体 + final-script 响应类型扩展 + `types/index.ts` TestCase 扩展
- [x] 4.5 create 页确认不暴露 CODE（回归检查：创建页仅 NLP/YAML 两选项，未改动）
- [x] 4.6 详情页移除「最终脚本」按钮及其对话框/状态逻辑（用户决策；后端 final-script 接口与前端 API 封装保留）
- [x] 4.7 录制脚本开放编辑与保存（用户决策，推翻 D9 只读）：CodeViewer 支持 editable + v-model:code 双向同步，对话框含未保存标记、保存按钮（PUT /cases/{id} script 字段）与安全提示

## 阶段五：验证与交付

- [x] 5.1 `mvn -q -pl platform-service -am compile -DskipTests` 通过（EXIT 0）
- [x] 5.2 `npx tsc`（execute-service）通过（EXIT 0）+ execute-service `npm run build` 通过；前端 `npm run build` 通过 + `read_lints` 零错误
- [ ] 5.3 API 实测：脚本上传接口、CODE 执行下发、STALE 拒绝、详情 script 查询（PowerShell UTF8 body）——用户自行执行
- [ ] 5.4 端到端：NLP 执行成功 → 脚本生成入库 → CODE 执行（含人为破坏 selector 触发兜底）→ 报告含兜底标注 → sw8/Kafka 报文回传确认——用户自行执行
- [ ] 5.5 `verification/evidence.md` + `verification/report.md` 填写实测证据与结论——用户自行执行（测试用例清单见 `verification/test-cases.md`）
