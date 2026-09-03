# 升级 Midscene 插件 1.52 → 1.92 并恢复平台对接

## 变更概述

将 Chrome 插件从基于 Midscene 1.52 的定制版（"测试用例可视化插件"）升级到 Midscene 1.92 官方版基底，移植全部二开能力（用户登录、选择/创建项目、智能选择用例步骤、一键同步平台），同时修复后端接口演进导致的插件失联问题，并将 execute-service 的 Midscene 依赖从 1.8.3 升级到 1.9.2 实现全链路版本对齐。

## 背景与问题

### 现状
- `Midscene.js 1.52/` 是深度定制版插件：含 `auth.js`（登录认证）、`export-test-case.js`（步骤导出）、定制 `index.html`（工具栏/登录遮罩/项目弹窗/导出弹窗）及 manifest 改名
- `Midscene.js 1.92/` 是官方原版（含 Chrome 商店 key/update_url），功能更新但无任何定制
- execute-service 实际锁定 `@midscene/* 1.8.3`（package.json 声明的 `^1.12.1` 为无效版本号，疑为笔误）

### 问题（1.52 插件无法连接平台的三个根因）
1. **登录响应变更**：`AuthService.login` 的 token 只写入 HttpOnly Cookie，响应体不再含 `token` 字段，插件 Bearer 模式失效
2. **CORS 缺失**：platform-service 无 CORS 配置（网关仅放行 localhost:3000/5173），`chrome-extension://` 源的跨域请求被浏览器拦截
3. **执行接口迁移**：`POST /api/platform/cases/{id}/execute` 已移除，现为 `POST /api/platform/execute/cases/{id}` 及一步式 `POST /api/platform/execute/create-and-execute`

另有轻度不兼容：项目列表接口 `size` 参数上限 100（插件请求 500 会 400）。

## 目标

1. **插件升级**：以 `Midscene.js 1.92` 目录为基底就地定制，名称保持「测试用例可视化插件」，界面文案「中台」统一改为「平台」
2. **能力完整移植**：用户登录 → 选择/创建项目 → 智能选择用例步骤（成功默认勾选、失败默认排除）→ 一键同步平台（改用 `create-and-execute` 一步式接口）
3. **后端最小配合改动**：登录响应体补回 token 字段（Cookie 照发，向后兼容）；platform-service 增加 CORS 放行 chrome-extension 源
4. **执行引擎对齐**：execute-service `@midscene/core` + `@midscene/web` 升级至 1.9.2，修正 package.json 无效版本号

## 非目标（Non-Goals）

- 不改动前端 Vue 业务的现有功能
- 不迁移/重构 execute-service 的执行链路（仅升级依赖版本并回归验证）
- 不处理 Midscene 1.10+ 的 MCP 下线问题（1.9.2 不受影响）
- 不修改插件官方 bundle 文件（static/js、worker.js 等官方构建产物）

## 影响范围

| 模块 | 变更内容 |
|------|----------|
| `Midscene.js 1.92/` | manifest 改名去商店标识；index.html 注入定制块；scripts/ 新增 auth.js、export-test-case.js |
| `backend/platform-service` | AuthService.login 响应体补 token；SecurityConfig 增加 CORS 配置 |
| `execute-service` | package.json 版本修正 + 升级 @midscene 1.9.2 + 编译验证 |

## 验收标准

1. 插件加载后显示登录遮罩，输入平台账号密码可登录（token 正确获取并持久化）
2. 登录后可拉取项目列表（size=100 分页参数合法）、选择或创建项目
3. 在侧边栏与 AI 对话执行操作后，点「导出步骤」能抓取全部用户消息步骤；失败步骤自动标记并默认排除，可手动改选
4. 点击「生成用例」调用 `POST /api/platform/execute/create-and-execute`，平台用例列表出现新用例并开始异步执行
5. 界面无「中台」字样（统一为「平台」）；无 Midscene 版本号泄露（隐藏版本号脚本生效）
6. execute-service `pnpm build` 编译通过；执行一条缓存命中的用例回归缓存/报告链路正常
