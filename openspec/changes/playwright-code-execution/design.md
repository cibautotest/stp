# 技术方案：playwright-code-execution

## 1. 总体架构

```
┌────────────────────────── execute-service :3001 ──────────────────────────┐
│                                                                            │
│  worker.execute(task)                                                      │
│    ├─ executionMode == 'NLP'|'YAML' ──▶ YamlRunner（现有，不改语义）          │
│    │       ├─ 登录阶段: loginAgent (login_{methodId} 缓存, 不录制)           │
│    │       ├─ 业务阶段: agent.runYaml / aiAct                               │
│    │       │    └─ + onDumpUpdate 监听（新增：录制事件流）──────────┐        │
│    │       └─ 执行成功 ──▶ CodeRecorder（新增）◀────────────────────┘        │
│    │            数据源: dump事件流 × plan/locate cache(双保险)                │
│    │            产出: recorded.ts ──▶ PUT /internal/scripts/{caseId}        │
│    │                                                                       │
│    └─ executionMode == 'CODE' ──▶ CodeRunner（新增）                         │
│            ├─ 登录阶段: 复用现有 runLoginStage（YAML/缓存，不录制）           │
│            ├─ 业务阶段: vm 注入执行 script                                  │
│            │    ├─ 可翻译步骤: stp.click/fill/... → 纯 Playwright           │
│            │    ├─ @ai 步骤 / 失败兜底: Midscene agent (attach 同一 page,   │
│            │    │   同 caseId 缓存; 兜底命中回写 locate cache)               │
│            │    └─ NetworkObserver.install(context)（原样复用: sw8 染色      │
│            │        + x-test-execution-id 注入 + Kafka 报文回传）            │
│            └─ 产出: 轻量 HTML 报告 ──▶ PUT /internal/reports/{executionId}  │
└────────────────────────────────────────────────────────────────────────────┘
        ▲ 下发 ExecuteRequest(+script)          ▲ 回调/上传
┌───────┴────────── platform-service :8081 ─────┴───────────────────────────┐
│  test_cases.script(LONGTEXT, 启用) + script_status + script_source_*      │
│  execution_mode 枚举扩 CODE; nlp/yaml 变更 → script_status=STALE           │
│  新增 InternalScriptController: PUT /api/platform/internal/scripts/{caseId}│
└────────────────────────────────────────────────────────────────────────────┘
```

## 2. 录制器（CodeRecorder）

### 2.1 数据源（三层，双保险）

执行 NLP/YAML 时，Midscene 1.12.2 提供以下可重放定位信息（已实测验证）：

| 数据源 | 内容 | 取用方式 | 作用 |
|---|---|---|---|
| **onDumpUpdate 实时钩子** | 每步执行后回调：Locate 任务 `output.element`（rect/center/dpr）、`hitBy.context.xpath`、`log.matchedElement` | `agent.addDumpUpdateListener` / `agent.onDumpUpdate`（`@midscene/core/dist/types/agent/agent.d.ts`） | **主源**：在执行当时的 DOM 上反查生成优化 selector |
| **locate 缓存** | `midscene_run/cache/{caseId}.cache.yaml` 中 `type:'locate'` 条目 `cache.xpaths`（数组，绝对 XPath + normalize-space 文本谓词） | 执行后读缓存文件 | **兜底源**：xpath 候选数组 |
| **plan 缓存** | `type:'plan'` 条目 `yamlWorkflow`：步骤序列（动作类型 + locate 语义描述 + value） | 执行后读缓存文件 | **步骤骨架**：动作顺序、输入值、语义注释 |

数据关联键：`locate.prompt`（语义描述）↔ dump Locate 任务 `param.prompt` ↔ 生成代码的步骤注释。

### 2.2 selector 升级策略（关键质量决策，已实施）

locate 缓存的 XPath 是绝对路径 + 位置索引，对 DOM 变化脆弱。已实施双层策略：

1. **执行时 DOM 反查（主源，对齐 Playwright codegen）**：`DumpCollector` 拿到 page 引用，`onDumpUpdate` 每步回调时（页面仍是该步后状态）以命中 xpath 反查真实 DOM 元素，注入浏览器的探测函数按 codegen 同款优先级生成升级 selector：`data-testid > id > role+name > placeholder > 短文本`；页面已跳转时静默失败降级。
2. **locate 缓存 xpath（兜底源）**：反查失败/未探测到时的候选。

生成代码的 selector 候选链 = `[升级selector, ..., xpath兜底]`（最多 3 条），首选语义定位（`role=button[name="登 录"]`、`text="触发故障"` 等自文档化形态），抗 DOM 改版能力与 codegen 同级；候选链全失败再走 Midscene AI 兜底。探测含**动态 id 黑名单**（`el-id-`/`radix-`/`:[rR]`（React useId）/`Mui`/`floating-` 等组件库自动生成 id）：此类 id 每次加载都变，定位必然失败且计数复用时可能命中错误元素，直接排除（比 xpath 兜底更不可靠）。

另配套 **click+fill 合并**：`click(x)` 紧跟 `fill(x)` 且 locate 相同 → 合并为单条 `stp.fill`（fill 自带定位），生成代码行数减半、形态对齐 codegen。

### 2.3 动作映射表（Midscene action → Playwright 代码）

| Midscene action | 生成代码（经 stp 包装函数） | 备注 |
|---|---|---|
| `aiTap` + locate | `await stp.click(page, sel, '语义描述')` | sel 为 selector 链 |
| `aiInput` + value | `await stp.fill(page, sel, '语义描述', '值')` | 值原样字面量 |
| `aiHover` | `await stp.hover(page, sel, '语义描述')` | |
| `aiScroll` | `await stp.scroll(page, sel, '语义描述', {dx,dy})` 或 `mouse.wheel` | |
| `Sleep` | `await page.waitForTimeout(ms)` | 直接裸调用 |
| 导航（web.url / goto） | `await page.goto(url)` | 与登录页相同则跳过（复用 `urlsEqual` 语义） |
| `uploadFile` | `await stp.upload(page, sel, '语义描述', filePath)` | 走 fileChooserAccept 双机制 |
| `downloadFile` | `await stp.download(page, '语义描述', fileName)` | waitForEvent('download') + saveAs |
| `assertFile` | `await stp.assertFile('语义描述', 文件名, 包含文本)` | 经 `/local-file-text` 确定性断言 |
| `aiAssert`（简单文本类） | `await stp.expectText(page, sel, '语义描述', 预期文本)` | 仅当语义可确定性翻译时 |
| `aiAssert`（复杂语义）/ `aiWaitFor` | `await stp.ai(page, '原语义注释')` — **@ai 步骤** | CODE 执行时仍走 Midscene |
| `[动态]` 步骤（验证码/日期/随机数） | `await stp.ai(page, '原语义注释')` — **@ai 步骤** | 动态值禁止固化为字面量 |

**@ai 步骤是本方案的安全阀**：凡不可确定性翻译的动作（复杂断言、动态值、等待条件），生成代码时保留原语义注释、执行时走 Midscene，保证 CODE 模式语义无损。

### 2.4 生成脚本形态（目标产物）

```ts
// STP 自动录制脚本 | 用例: xxx | 源执行: {executionId} | 录制时间: ...
// 登录阶段不录制：执行时由登录方式(login_xxx 缓存)完成，登录后从 targetUrl 继续
import type { StpRunner } from './stp-types'; // 仅类型，运行时由执行机注入

export async function run(stp: StpRunner): Promise<void> {
  const { page } = stp;
  await page.goto('https://…/order-list');            // @goto 业务目标页
  await stp.click(page, ['#submit-btn', "role=button[name='提交订单']"],
    '点击提交订单按钮');                                // 语义注释=兜底 prompt
  await stp.fill(page, ['#amount', "text=金额"], '填写金额', '100');
  await stp.ai(page, '校验页面显示受理成功提示');        // @ai: 复杂断言，走 Midscene
}
```

要点：
- 脚本是**调用注入上下文 `stp` 的普通 async 函数**，不 import 任何运行时模块——执行机用 `new Function('stp', code)` 注入执行，免文件落盘、免 tsx 编译、超时/取消可包裹 `withTimeout`（`stp` 上暴露 cancel 检查点）。
- 每步 selector 为**数组（优先级链）**，`stp.click` 依次尝试；全失败 → 触发 AI 兜底。
- 注释保留 Midscene 语义描述（= locate.prompt），是兜底与人工审读的双重语义源。
- 脚本内容以字符串形式上传/存储，`script` 内不含密钥（登录在阶段外完成，密码不出现在脚本中——信任边界收敛的关键）。

### 2.5 录制触发条件

- 仅当业务阶段执行结果为 SUCCESS 时生成并上传；失败执行不录制（部分成功不录，避免半截脚本）。
- 记录 `script_source_execution_id`（追溯源报告）。
- 录制器对执行链路零侵入：仅在 YamlRunner 创建 agent 处额外挂 listener，产物生成放 worker 收尾阶段。

## 3. CODE Runner（代码执行模式）

### 3.1 执行流程

1. 复用 `chromium.launch`（channel:'chrome'，忽略证书错误）→ `browser.newContext` → **`NetworkObserver.install(context)`（sw8 染色 + Kafka 报文，代码级复用，不重写）** → `context.newPage()`；
2. 登录阶段：完整复用 `runLoginStage`（`loginMethod.type != 'none'` 时，独立缓存、回调 cache-status、浏览器不关闭）；
3. 业务阶段：`urlsEqual` 判断 targetUrl 与登录页关系（语义与现有 yaml-runner 一致）→ `page.goto(targetUrl)`；
4. **Midscene agent 惰性创建**：初始不实例化（`generateReport:false`）；仅当遇到 `@ai` 步骤或兜底触发时才 `new PlaywrightAgent(page, { cache: { id: caseId } })`——共用同一 caseId 缓存，兜底新命中自动写入 locate 缓存（反哺下次录制）；
5. `new Function('stp', script)` + 注入 `stp` 上下文执行，整体包裹 `withTimeout`（默认 600s 沿用）；
6. 每步执行结果（含 AI 兜底标记、新 selector、耗时、失败原因）汇入步骤表；
7. 收尾：生成轻量 HTML 报告 → `ReportManager.uploadReport`（原通道）→ `notifyPlatform` 回调（原通道）→ 若兜底发生过，`uploadCacheIfPresent` 回传更新后的缓存（原通道）。

### 3.2 stp 包装函数与兜底桥（核心）

```
stp.click(page, sels, prompt)
  ├─ for sel of sels: locator(sel) → waitFor(state:'visible', timeout: stepTimeout)
  │    └─ 命中 → locator.click() → 记录 {sel, ok:true, elapsed} → return
  ├─ 全部 selector 失败 → FallbackBridge.aiTap(page, prompt)
  │    ├─ 惰性创建/复用 Midscene agent（attach 同一 page）
  │    ├─ agent.aiTap(prompt) → 成功 → 记录 {ok:true, aiFallback:true, hitBy}
  │    └─ 失败 → 抛出步骤异常（脚本终止，走失败报告路径）
  └─ Cancelled 检查点：每步入口检查取消标记
```

- 兜底 prompt = 该步骤语义注释（录制时已固化）。
- `@ai` 步骤直接调 FallbackBridge（同一路径，只是主动而非失败触发）。
- 兜底事件在报告中高亮标注（`AI兜底` 徽标 + 命中新 xpath），供人工决定是否重新录制。

### 3.3 CODE 模式报告

自建轻量 HTML（单文件、内联样式，与现有报告中心 `/reports/content/{executionId}` 通道兼容）：

- 头部：用例名、执行模式 CODE、总耗时、通过率、AI 兜底次数；
- 步骤表：序号 | 语义注释 | 代码片段（selector 链）| 结果 | 耗时 | 兜底标记 | 失败原因；
- 失败/兜底步骤附 Playwright 截图（`page.screenshot`，仅异常步骤拍摄，控制体积）；
- 上传走现有 `PUT /internal/reports/{executionId}`（text/html + token，不超 50MB 限制）。

**不与 Midscene 原生报告混排**：CODE 报告是独立格式，报告中心已是 iframe/链接读取 HTML，无需前端改造即兼容。

## 4. 数据模型与接口变更（platform-service）

### 4.1 test_cases 表（`init.sql` 已预留 script LONGTEXT，启用 + 增状态列）

新增迁移 `V<yyyyMMdd>__add_recorded_script.sql`（注意去 BOM）：

```sql
ALTER TABLE test_cases
  ADD COLUMN script_status VARCHAR(16) DEFAULT 'NONE'
    COMMENT '录制脚本状态: NONE/RECORDED/STALE',
  ADD COLUMN script_source_execution_id VARCHAR(64) DEFAULT NULL
    COMMENT '录制来源执行ID',
  ADD COLUMN script_recorded_at DATETIME DEFAULT NULL COMMENT '录制时间';
-- script 字段(init.sql 已有 LONGTEXT)直接启用，不重复新增
```

状态机：

```
NONE ──(NLP/YAML 首次成功执行+录制上传)──▶ RECORDED ──(再次成功执行)──▶ RECORDED(覆盖更新)
                                             │
                              (nlp / yaml_flow 变更) ──▶ STALE ──(重新录制成功)──▶ RECORDED
```

失效规则与登录方式缓存失效语义对齐：`TestCaseController PUT /{id}` 中检测 `nlp / yaml_flow` 实际变更 → `script_status = 'STALE'`（脚本内容保留供对照，不物理删除）。

### 4.2 ExecuteRequest 四层同步（漏一层即静默丢失，全部已定位）

| 层 | 文件 | 改动 |
|---|---|---|
| Java 请求模型 | `model/ExecuteRequest.java` | 加 `script`（@Size 上限，建议 ≤200000 与 yamlScript 对齐）；`executionMode` @Pattern 扩 `CODE` |
| Java 组装 | `service/CaseExecutionService.java` `buildExecuteRequest`（行 158-225） | mode 归一逻辑改三分支；CODE 时校验 script 非空且用例 script_status=RECORDED（STALE 拒绝执行并提示）；透传 script |
| TS 输入模型 | `execute-service/src/models/test-case.ts` | `TestCaseInput.script?: string`；`executionMode: 'NLP'|'YAML'|'CODE'` |
| zod 校验 | `execute-service/src/api/schemas.ts:32` | `z.enum` 扩 CODE + script 字段 |
| OpenAPI | `execute-service/src/api/openapi-schemas.ts:58` | 枚举同步 |
| 队列接口 | `execute-service/src/queue/interface.ts:15` | `QueueTask.script?` |
| 编排器 | `execute-service/src/core/orchestrator.ts:57,101` | 两处 enqueue 透传 script |
| worker 分发 | `execute-service/src/core/worker.ts:58` | 三分支：`CODE → codeRunner.run(...)` |

### 4.3 新增内部接口（对齐 `/internal/caches` 现有模式）

`InternalScriptController`：`PUT /api/platform/internal/scripts/{caseId}`

- 白名单（`SecurityConfig`）+ `X-Report-Upload-Token` 令牌校验 + 大小上限（复用 `reports.max-upload-size` 或单独配置，建议 1MB 足够）；
- body：text/plain 脚本内容；另以 query/头携带 `executionId`（写 `script_source_execution_id`）；
- 行为：更新 `test_cases.script / script_status='RECORDED' / script_source_execution_id / script_recorded_at`；
- STALE 竞态保护（精确判定，v1 修订）：执行下发时把当时的用例内容哈希（`CaseContentDigest`：nlp+yamlFlow 的 SHA-256）记入 `execution_record.dispatched_content_hash`（三个落库点同步写入）；上传录制脚本时若用例为 STALE，比对当前内容哈希与下发时哈希——**一致（STALE 发生在下发前，正常重录）→ 放行覆盖并置 RECORDED；不一致或无法判定（执行期间被改 / 无 executionId / 旧记录无哈希）→ 409 拒绝**。初版"凡 STALE 一律拒绝"会误杀正常重录流程（用户改 NLP → STALE → 重新执行 → 上传被拒），已修复。

### 4.4 前端变更

| 位置 | 改动 |
|---|---|
| `frontend/src/api/cases.ts` | 执行请求体加 `script`；新增 `getRecordedScript`（或 final-script 响应体扩展 script 字段） |
| `frontend/src/views/detail/index.vue` | ① 新增"录制脚本"卡片/Tab：CodeMirror 6 只读实例（已装依赖 + 补 `@codemirror/lang-javascript`）+ one-dark 主题 + TS 高亮 + 复制按钮；`@ai` 步骤行渲染标记徽标；STALE 状态显示"已过期，需重新录制"徽标 + 引导重新执行 NLP。② 执行操作区 mode 切换加 `CODE`（仅 RECORDED 可选，STALE/NONE 禁用并 tooltip 说明）。③ 现有 FinalScriptPreview 对话框（行 156-202 的 el-dialog + pre）保持不动，CODE 模式下预览内容为 script |
| `frontend/src/views/create/index.vue` | **不暴露 CODE**（新用例必然无脚本） |
| `frontend/src/views/cases/index.vue` | 用例列表状态列加录制状态小标记（可选，P2） |

## 5. 关键决策记录（含理由）

| # | 决策 | 备选与否决理由 |
|---|---|---|
| D1 | 独立 CODE runner（vm/Function 注入执行），Midscene 惰性实例化仅做兜底 | 备选"locate 缓存预灌 + Midscene cache-hit 执行"（零改造但保留全部框架开销，非真正代码执行，速度收益打折）——否决 |
| D2 | 登录阶段不录制，CODE 执行仍走登录方式阶段 | 录登录会因改密码导致全项目脚本失效，破坏 login_methods 资产化设计 |
| D3 | selector 优先级链（testid/id > role > text > label > css > xpath），onDumpUpdate 当时 DOM 反查升级 | 直接用缓存绝对 XPath 对 DOM 变化脆弱 |
| D4 | @ai 步骤（复杂断言/动态值/aiWaitFor）不翻译，CODE 执行时走 Midscene | 机械翻译语义失真；动态字面量重放必错 |
| D5 | 兜底 = stp 包装函数 catch → agent.aiXxx(语义注释)，共用 caseId 缓存 | 裸 playwright 无兜底语义源；agent 复用让兜底命中反哺 locate 缓存 |
| D6 | CODE 报告 = 自建轻量 HTML，走原上传通道 | 复用 Midscene 报告不可行（纯代码执行无 Midscene 事件流） |
| D7 | 脚本经独立内部接口上传（`/internal/scripts/{caseId}`） | 报告通道是纯 HTML 单文件设计，不适合捎带；回调体加 script 会放大回调事务且受 @Size 约束 |
| D8 | nlp/yaml 变更 → script_status=STALE；STALE 拒绝 CODE 执行 | 防止"旧页面旧语义"僵尸脚本；与登录缓存失效语义一致 |
| D9 | ~~前端 v1 只读展示~~ → **用户决策（2026-11-22）：开放编辑与保存**。录制脚本对话框支持 CodeMirror 编辑 + 保存（走现有 `PUT /cases/{id}` 的 script 字段），保存后原样下发执行机；对话框内置安全提示（编辑内容不经录制校验，请确认安全） | 录制脚本可编辑=平台可下发任意代码到执行机，信任边界依赖内网信任模型 + 提示文案；若后续对外开放需加脚本白名单校验/沙箱强化 |
| D10 | 兜底成功不自动回写脚本（只回写 locate 缓存 + 报告标注） | 自愈回写有写坏脚本风险，先观察兜底命中率，v2 决策 |
| D11 | 录制仅在业务阶段 SUCCESS 后触发 | 防半截/失败脚本污染 |

## 6. 安全与信任边界

- 录制脚本由系统生成（不含凭据：登录在阶段外，密码不进脚本）；
- CODE 执行 = 执行平台下发的代码字符串：信任模型与现有 yamlScript 等价（均来自平台库），但**若未来开放前端编辑，需引入脚本白名单校验/沙箱强化**——本变更不开放编辑（D9）；
- `new Function` 注入的 `stp` 上下文是受限 API 面（page 之外仅暴露受控包装），不注入 `require/process/fs`；
- 内部上传接口沿用 X-Report-Upload-Token + 大小限制 + 白名单三重防护（对齐 InternalReportController 模式）。

## 7. 风险与未决项

| 风险 | 缓解 |
|---|---|
| iframe 内元素：Midscene hitBy 可能含跨 frame xpath（插件分隔符 `|>>|` 类似语义） | v1 仅支持主 frame；录制遇 frame 元素标记 @ai 步骤 |
| onDumpUpdate 回调时页面已跳转导致反查失败 | 降级用 locate 缓存 xpath（双保险数据源） |
| 兜底时 LLM 服务不可用 | 步骤异常终止走失败报告（与现有 NLP 模式 AI 失败行为一致） |
| 大用例脚本体积 | selector 链截断（最多 3 条）+ 上传/字段上限校验 |
| 批量执行中 CODE 与 NLP 混跑 | 无冲突：执行模式是 per-request 字段，批次链路（BatchExecutionService）零改动透传 |

未决项（实施时确认）：
- stepTimeout（单步 selector 尝试超时）默认值：建议 10s，可配置；
- CODE 模式下 `ai_config_snapshot` 快照是否参与（兜底用全局 ai_config，与现状一致即可）；
- STALE 状态在批量执行计划中的展示策略（P2）。
