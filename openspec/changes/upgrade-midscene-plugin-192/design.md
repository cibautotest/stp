# 技术设计 — Midscene 插件 1.52 → 1.92 升级

## 方案总览

三层并行改造：后端最小配合（恢复插件可用的认证与跨域通道）→ 插件二开移植（1.92 基底 + 定制层注入）→ execute-service 依赖对齐（1.8.3 → 1.9.2）。

```
┌────────────────────────────────────────────────────────────┐
│  Chrome 插件（Midscene.js 1.92 目录就地定制）                 │
│  ┌────────────────────────────────────────────┐            │
│  │ 官方层：static/js bundle + worker.js（不动）│            │
│  ├────────────────────────────────────────────┤            │
│  │ 定制层：auth.js + export-test-case.js        │            │
│  │         index.html 注入工具栏/弹窗/遮罩      │            │
│  └────────────────────────────────────────────┘            │
└──────────────┬─────────────────────────────────────────────┘
               │ ① Bearer token 登录 ② create-and-execute
               ▼
┌────────────────────────────────────────────────────────────┐
│  platform-service (:8081)                                   │
│  · AuthService.login：响应体补 token（Cookie 保留）           │
│  · SecurityConfig：CORS 放行 chrome-extension:// 源          │
└──────────────┬─────────────────────────────────────────────┘
               │ RestTemplate /execute/async
               ▼
┌────────────────────────────────────────────────────────────┐
│  execute-service (:3001)  @midscene 1.8.3 → 1.9.2           │
└────────────────────────────────────────────────────────────┘
```

## 一、后端改动（最小侵入）

### 1.1 AuthService.login 响应体补 token

现状：token 仅通过 `Set-Cookie: token=...; HttpOnly; SameSite=Strict` 下发，响应体只有 `{user}`。

问题：插件运行在 `chrome-extension://` 源，HttpOnly Cookie 无法被插件 JS 读取；跨域携带 Cookie 又需 `credentials:'include'` + CORS `allowCredentials` + 固定扩展 ID（我们删除了 manifest key，ID 随加载路径变化），链路脆弱。

方案：`AuthService.login` 的返回 Map 中加入 `token` 字段。Cookie 照常下发，Vue 前端不受影响（其登录逻辑读 body 的 user + 浏览器自动存 Cookie）。插件端继续沿用 Bearer Header 模式（`JwtAuthenticationFilter` 本就支持，Header 优先）。

### 1.2 SecurityConfig 增加 CORS

platform-service 无任何 CORS 配置，插件直连 `http://localhost:8081` 的 POST/GET 会被浏览器预检拦截。

方案：在 `SecurityConfig` 中通过 `CorsConfigurationSource` Bean + `http.cors()` 放行：
- `allowedOriginPatterns("*")` — 因为解压加载的扩展 ID 不固定，无法枚举具体 origin；鉴权完全依赖 Bearer token，不启用 allowCredentials，无 Cookie 泄露面
- `allowedMethods`：GET/POST/PUT/DELETE/OPTIONS
- `allowedHeaders`：Authorization、Content-Type、X-Requested-With

安全评估：CSRF 本已禁用（无状态 JWT API），CORS 放行仅允许浏览器跨源调用，认证强度由 JWT 决定，风险可接受；origins 通过 `application.yml` 可配置收紧。

## 二、插件改动（Midscene.js 1.92 目录）

### 2.1 manifest.json

| 字段 | 官方 1.92 | 定制后 |
|------|-----------|--------|
| name | Midscene.js | 测试用例可视化插件 |
| version | 1.92 | 1.92（保留，标识基底版本） |
| key | 存在 | **删除**（避免与商店版冲突，允许任意机器加载） |
| update_url | 存在 | **删除**（防止被商店自动覆盖定制版） |
| 其余权限/background/side_panel | — | 不动 |

### 2.2 index.html

以 1.92 的官方结构为基底（保留其全部 `<script defer src="/static/js/...">` 引用），注入 1.52 的定制块：

1. `<head>` 内：1.52 的全部定制 CSS（工具栏、导出弹窗、登录遮罩、项目弹窗、深色模式）+ 在官方 bundle 引用**之前**插入 `<script defer src="/scripts/auth.js">` 与 `<script defer src="/scripts/export-test-case.js">`
2. `<body>` 内：1.52 的全部定制 DOM（工具栏含联系人图标、`#root`、隐藏版本号脚本、导出弹窗、登录遮罩、项目选择弹窗）
3. 文案调整：「中台」→「平台」（如"登录中台"→"登录平台"、"请检查中台是否已启动"→"请检查平台是否已启动"）

关键兼容性事实（已核实）：`.user-message-bubble` 类在 1.92 的 `index.ac5049b9.js` 中仍然存在（2 处匹配），导出功能的 DOM 依赖成立。

### 2.3 scripts/auth.js（移植 + 适配）

以 1.52 版为基底，改动点：

| 项 | 1.52 行为 | 1.92 移植后 |
|----|-----------|------------|
| login | 读 `data.token` | 不变（后端已补回 token，正好兼容） |
| getProjects | `?size=500` | `?size=100`（后端 `@Max(100)` 校验），仍读 `data.items` |
| createProject | POST /api/platform/projects | 不变（契约未变） |
| 平台地址 | localStorage `midscene_platform_url` 或 `http://localhost:8081` | 不变 |
| 「中台」文案 | 多处 | 全部改「平台」 |

### 2.4 scripts/export-test-case.js（移植 + 适配）

以 1.52 版为基底（三阶段状态机、`.user-message-bubble` 抓取、失败轮询、翻译字典全保留），改动点：

1. **执行接口替换**：原「创建用例 + POST /cases/{id}/execute 两步」改为一步式：
   ```
   POST /api/platform/execute/create-and-execute
   Body: { projectId, name, nlp }
   ```
   响应 `CreateAndExecuteResponse` 含 `success/caseId/error`，离线（执行机不可用）时 success=false 但用例已创建——按原逻辑降级为 warning 提示。
2. **文案**：所有「中台」→「平台」。
3. **翻译字典校准**：对照 1.92 实际 UI 英文文案增删条目（保留 1.52 已有映射，运行后按实际渲染效果补充；1.92 若新增 UI 文案，未映射仅显示英文，不阻断功能）。

### 2.5 显式不做

- 不修改 `scripts/worker.js`、`event-recorder-bridge.js`、`htmlElement.js`、`water-flow.js` 等官方构建产物
- 不修改 `static/js/**` 官方 bundle
- 不动 `confirm.html`、`popup.html`、fonts、wasm

## 三、execute-service 升级（1.8.3 → 1.9.2）

### 3.1 版本修正

package.json 中 `"@midscene/core": "^1.12.1"`、`"@midscene/web": "^1.12.1"` 为无效版本（Midscene 无 1.12.x 版本线，实际 lockfile 锁定 1.8.3）。改为精确版本 `1.9.2`，与插件基底同源。

### 3.2 API 兼容性评估（已核查官方 changelog）

| 使用点 | 位置 | 1.9.x 状态 |
|--------|------|-----------|
| `new PlaywrightAgent(page, opts)` | yaml-runner.ts | 构造参数无破坏性变更 |
| `cache: { id: caseId }` | yaml-runner.ts | 保留；1.9 增强为缓存失效自动回退模型重规划并更新缓存（利好"缓存自愈"） |
| `agent.runYaml(tasks)` | yaml-runner.ts | 保留；1.9 修复了显式 reportFileName 保留问题 |
| `agent.aiAct(nlp)` | yaml-runner.ts | 保留；新增图片提示等能力 |
| `agent.destroy()` | yaml-runner.ts | 保留 |
| `ReportMergingTool` | merge.ts | 保留（1.8 起 CLI 新增 report-tool merge 同源能力） |

### 3.3 升级步骤与回归项

1. 改 package.json → `pnpm install` → `pnpm build`（tsc 编译，类型不匹配会在此暴露）
2. 回归验证：
   - YAML 模式执行一条用例（缓存首次生成 `{caseId}.cache.yaml`）
   - 再执行一次验证缓存命中
   - NLP 模式（aiAct）执行一条
   - 测试计划执行 → 报告合并（ReportMergingTool）
   - 确认报告 HTML 能被 platform 正常读取展示（报告文件格式兼容）

## 四、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| 1.92 React UI 结构变化导致翻译字典遗漏 | 中 | 运行后对照实际界面补充字典；未映射仅显示英文，不阻断功能 |
| 1.9.2 报告 HTML 结构变化影响平台解析 | 中 | 回归验证报告中心展示；Midscene 报告为自包含 HTML，platform 仅存储/转发 |
| `cache` 参数类型细节变更 | 低 | tsc 编译 + 缓存回归用例双重验证 |
| CORS 全开带来的安全面 | 低 | JWT Bearer 鉴权不弱化；origins 可配置收紧；无 Cookie 认证依赖 |

## 五、备选方案对比（决策记录）

### 插件鉴权方案

| 方案 | 描述 | 结论 |
|------|------|------|
| A. 后端补 token（已选） | login 响应体加回 token，插件 Bearer 模式 | 改动最小（1 行），复用现有 filter 能力 |
| B. Cookie + credentials | 插件 `credentials:'include'`，后端 allowCredentials + 枚举扩展 origin | 依赖固定扩展 ID（需保留 key），跨域 Cookie 链路脆弱 |
| C. 插件专属代理接口 | 后端为插件开独立会话接口 | 过度设计，违反最小接口原则 |

### 用例同步方案

| 方案 | 描述 | 结论 |
|------|------|------|
| A. create-and-execute 一步式（已选） | 单接口完成创建+执行，失败语义统一 | 契合"一键同步平台" |
| B. 两步式（创建 + execute/cases/{id}） | 保持 1.52 调用形态 | 中间态可能创建成功但执行失败，提示逻辑复杂 |
