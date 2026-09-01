# Midscene.js Chrome 插件集成 — 架构设计

> **状态**: 待评审 | **创建日期**: 2026-05-21 | **关联 PRD**: [plugin-integration-proposal.md](./plugin-integration-proposal.md)

---

## 1. 核心设计理念

**一句话总结**：插件负责"人在浏览器端登录 + 录制步骤"，平台负责"存储 + 批量回放执行"。

```
                    ┌── 用户浏览器登录（绕过SSO/验证码）──┐
                    │   插件录制/编写测试步骤              │
                    │   一键导出到平台                     │
                    └──────────────┬──────────────────────┘
                                   │ POST /api/plugin/test-cases/import
                                   ▼
                    ┌── 平台存储为 TestCase ──────────────┐
                    │   与原生用例统一管理                  │
                    │   通过 execute-service 回放执行       │
                    └──────────────────────────────────────┘
```

> ⚠️ **v1 关键限制**：插件导出时不携带 Cookie/Session，所以 execute-service 回放执行时，如果目标网站需要登录态，用户需要在 YAML 中补充登录步骤或确保目标网站支持免登。

---

## 2. 整体架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                        User's Chrome Browser                      │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Midscene.js Chrome Extension v1.52                         │   │
│  │                                                              │   │
│  │  已有模块（不改动）:                                          │   │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────────┐  │   │
│  │  │ Recorder │  │ Visual       │  │ export-test-case.js  │  │   │
│  │  │ 事件录制  │  │ Operator     │  │ 测试用例导出(已有)    │  │   │
│  │  └──────────┘  └──────────────┘  └──────────────────────┘  │   │
│  │                                                              │   │
│  │  ★ 新增模块:                                                  │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │ platform-bridge.js (~80行)                            │   │   │
│  │  │  - 读取 localStorage 中的平台配置 (URL + Token)        │   │   │
│  │  │  - 将测试步骤序列化为平台 JSON 格式                    │   │   │
│  │  │  - POST 到 platform-service                          │   │   │
│  │  │  - 展示导入结果 (成功/失败 + caseId)                  │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                  │                 │
│                  POST /api/plugin/test-cases/import                │
│                  Content-Type: application/json                    │
│                  Authorization: Bearer {jwt_token}                 │
└──────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Platform Service (8081)                        │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  PluginController.java (新增)                                │   │
│  │                                                              │   │
│  │  GET  /api/plugin/extension/download                        │   │
│  │    → 返回 Midscene.zip (静态文件)                            │   │
│  │                                                              │   │
│  │  POST /api/plugin/test-cases/import                         │   │
│  │    → 解析步骤 → 生成 YAML → 创建 TestCase → 返回 caseId     │   │
│  │                                                              │   │
│  │  GET  /api/plugin/test-cases/imported                       │   │
│  │    → 查询当前用户导入的用例列表                              │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  TestCaseService.java (扩展)                                 │   │
│  │  + importFromPlugin(PluginImportRequest req)                 │   │
│  │    - 按 projectName 查找/创建 Project                        │   │
│  │    - 将 steps[] 转为 YAML                                    │   │
│  │    - 保存 TestCase (source=PLUGIN)                           │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Execute Service (3001)                         │
│                       已有，无需改动                               │
│                                                                    │
│  POST /execute/async → YamlRunner → Playwright + Midscene Agent   │
│  GET  /reports/:id  → Midscene HTML 报告                          │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. 插件改造详情（实际实现）

> **实现方案比原设计更简洁**：不需要新增 `platform-bridge.js` 文件，也不需要在后端新增任何 API。插件直接复用平台现有 API（登录、项目CRUD、用例CRUD）。

### 3.1 修改文件：`scripts/export-test-case.js`

**改动策略**：最小化改动，不引入新文件。核心修改在 `handleCopy()`（即"生成用例"按钮的回调）。

**新增函数**：

| 函数 | 用途 |
|------|------|
| `validateForm()` | 校验项目名称/账号/密码非空 + 至少勾选 1 个步骤 |
| `showValidationErrors()` | 在步骤计数区域展示红色错误提示 |
| `sendToPlatform()` | 核心：登录→查找/创建项目→创建用例 |
| `getPlatformUrl()` | 从 localStorage 读取平台地址（默认 `http://localhost:8081`） |
| `setBtnLoading()` | 按钮加载态切换 |
| `showResultMsg()` | 显示成功/失败结果 |

**核心流程** (`sendToPlatform`):
```javascript
// Step 1: 账号密码登录
POST {platformUrl}/api/platform/auth/login
  → { username, password }
  ← { token, user }

// Step 2: 查找项目（按名称匹配）
GET {platformUrl}/api/platform/projects?size=100
  → 从 records[] 中查找 name === projectName

// Step 2b: 项目不存在则创建
POST {platformUrl}/api/platform/projects
  → { name: projectName }
  ← { id: projectId }

// Step 3: 创建测试用例
POST {platformUrl}/api/platform/cases
  → { projectId, name, nlp }
  ← { id: caseId, ... }
```

### 3.2 改造范围

| 文件 | 操作 | 说明 |
|------|------|------|
| `scripts/export-test-case.js` | **修改** | 验证+API 集成，约 120 行新增代码 |
| 其他文件 | **无需修改** | index.html、manifest.json 保持不变 |

### 3.3 关键设计决策

1. **不新增 backend API** — 直接复用 `/api/platform/auth/login`、`/api/platform/projects`、`/api/platform/cases` 三个现有端点
2. **不新增 JS 文件** — 所有逻辑内嵌在 `export-test-case.js`，避免修改 `index.html` 的 `<script>` 引用
3. **账号密码登录** — 用户填写的中台账号密码直接用于登录，无需手动配置 Token
4. **平台地址可配置** — 默认 `http://localhost:8081`，可通过 `localStorage.setItem('midscene_platform_url', ...)` 覆盖

---

## 4. 后端 API（无需新增）

> 插件直接复用平台现有 API，无需新增任何 Controller 或端点。

### 4.1 复用的现有 API

| API | 用途 | 认证 |
|-----|------|------|
| `POST /api/platform/auth/login` | 插件用账号密码登录获取 JWT | 白名单 |
| `GET /api/platform/projects?size=100` | 查询项目列表，按名称匹配 | Bearer Token |
| `POST /api/platform/projects` | 项目不存在时创建 | Bearer Token |
| `POST /api/platform/cases` | 创建测试用例（含 NLP 步骤） | Bearer Token |

### 4.2 数据格式映射

插件导出的步骤格式 → 平台 TestCase 字段：

```
插件步骤: "aiAct: 点击成长计划"
         "aiAct: 断言workbuddy"
           ↓
TestCase.nlp = "aiAct: 点击成长计划\naiAct: 断言workbuddy"
TestCase.name = "aiAct: 点击成长计划"（取首步骤前60字符）
```

---

## 5. 数据库改动

**无需任何数据库改动**。插件导入的用例直接存入现有 `test_case` 表，使用现有字段即可。

---

## 6. 前端新增：插件中心页面

### 6.1 路由

`/plugin-center`，导航栏新增入口图标。

### 6.2 页面结构

```
┌─────────────────────────────────────────────────────────┐
│  🧩 插件中心                                             │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Midscene.js 可视化测试插件                        │    │
│  │  版本: v1.52 | 基于 AI 的网页自动化测试            │    │
│  │                                                    │    │
│  │  [📥 下载扩展]  [📖 安装教程]  [🔑 获取Token]     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 安装步骤 (可折叠) ────────────────────────────┐    │
│  │  ① 点击下载，获得 Midscene.js 1.52.zip          │    │
│  │  ② 解压到本地文件夹（如 D:\midscene-extension） │    │
│  │  ③ Chrome 地址栏输入 chrome://extensions/       │    │
│  │  ④ 右上角开启「开发者模式」                      │    │
│  │  ⑤ 点击「加载已解压的扩展程序」→ 选择解压目录    │    │
│  │  ⑥ 点击工具栏🧩图标，固定 Midscene.js           │    │
│  │  ⑦ 打开目标测试网站，点击扩展图标开始使用        │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌─ 已导入用例 ──────────────────────────────────┐    │
│  │  用例名称      │ 项目       │ 导入时间   │ 操作  │    │
│  │  ─────────────────────────────────────────────│    │
│  │  登录验证测试   │ 电商项目   │ 05-21 19:30│ 查看  │    │
│  │  搜索商品流程   │ 电商项目   │ 05-21 18:15│ 查看  │    │
│  │  购物车结算     │ 电商项目   │ 05-20 14:00│ 查看  │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 用户操作流程

```
用户首次使用:
  ① 登录中台 → 插件中心 → 下载扩展
  ② 安装扩展 → 配置中台地址 + 获取Token并填入
  ③ 打开目标测试网站 → 手动登录
  ④ 点击扩展图标 → 开始录制/编写测试步骤
  ⑤ 导出 → 选择"发送到智能测试中台" → 选择/输入项目名
  ⑥ 刷新中台用例列表 → 看到导入的用例 → 点击执行

日常使用:
  ① 打开目标网站(已登录) → 扩展录制/编写
  ② 导出到中台(配置已记住,一键操作)
  ③ 中台查看/执行/管理
```

---

## 8. 技术风险 & 缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| 执行回放时无法复用用户登录态 | 🔴 高 | v1 需用户在 YAML 中补充登录步骤；v2 导出 Cookie |
| 扩展需"开发者模式"安装 | 🟡 中 | 提供图文教程；企业内网可接受 |
| 扩展 CSP 限制 (`script-src 'self'`) | 🟢 低 | 桥接脚本在 self 范围内，fetch 不受 CSP 限制 |
| Token 在 localStorage 明文存储 | 🟡 中 | 短期可接受；长期改为 session 级存储 |

---

## 9. 实际实现 vs 原设计

| 模块 | 原设计 | 实际实现 |
|------|--------|----------|
| 插件改造 | 新增 platform-bridge.js + 修改 export-test-case.js + 修改 index.html | **仅修改** export-test-case.js（约120行新增） |
| 后端 | 新增 PluginController + 3 个 API | **无需任何后端改动** |
| 数据库 | 新增 source 字段 | **无需改动** |
| 前端 | 插件中心页面 | 新增 `/plugins` 页面 + 路由 + 导航 |

实际工作量约 **3 天**（原估算 6 天）。

---

## 10. 替代方案 (已排除)

| 方案 | 为何排除 |
|------|----------|
| iframe 内嵌目标网站 | 跨域限制、X-Frame-Options 阻止 |
| Playwright CDP 远程连接用户浏览器 | 安全风险高、网络配置复杂 |
| Selenium Grid 维护预登录实例 | Cookie 过期成本高、MFA 无法处理 |
| 发布到 Chrome Web Store | 审核周期长、企业内网不必要 |
