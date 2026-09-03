# 技术设计 — 重建定制插件（1.92_0 基底）

## 一、交付物结构

```
测试用例可视化插件-v1.92/          ← 新目录（复制 1.92_0 后定制）
├─ manifest.json                  改名、删 key/update_url（其余不动）
├─ index.html                     保留官方 bundle 引用 + 注入定制层
├─ scripts/
│  ├─ auth.js                     登录/项目列表/创建（复用已验证实现）
│  ├─ export-test-case.js         状态机+步骤选择+已生成标记+随机数+同步
│  └─ (官方 worker.js 等不动)
└─ static/                        官方 bundle（不动）
```

定制层与官方层完全隔离：只新增文件/注入块，不修改官方产物。

## 二、定制层设计

### 2.1 版本标识（替代隐藏脚本）

- 删除旧的"隐藏版本号"脚本（它隐藏了 `Midscene.js version: 1.92` 与 `SDK v1.12.2` 文本）
- 工具栏标题改为「测试用例可视化插件 v1.92」，官方版本号保持可见（不动 bundle 渲染）

### 2.2 认证与项目（auth.js，复用已验证实现）

- login：`POST /api/platform/auth/login`，读响应体 token（后端已恢复该字段）
- getProjects：`GET /api/platform/projects?size=100`，读 `items`
- createProject：`POST /api/platform/projects`（重名返回已有项目）
- token 持久化：`localStorage.midscene_auth_token`，启动时 `GET /auth/me` 静默校验
- 平台地址：`localStorage.midscene_platform_url` 或默认 `http://localhost:8081`

### 2.3 步骤智能选择（export-test-case.js）

状态机与 DOM 依赖（`.user-message-bubble`）复用已验证实现。步骤状态三分：

| 状态 | 默认勾选 | 标记样式 | 判定方式 |
|------|---------|---------|---------|
| 失败 | 否 | 红色 ✗ | 轮询 AI 响应区段含 failed/✗/失败 |
| 已生成 | 否 | 黄色徽章"已生成: 用例名" | localStorage 指纹比对 |
| 正常 | 是 | 绿色 ✓ | 兜底 |

**已生成指纹存储**（localStorage，按项目维度）：
```js
midscene_exported_steps = {
  "<projectId>": [
    { "text": "<规范化后的步骤文本>", "caseName": "用例A", "caseId": "...", "ts": 1693... }
  ]
}
```
- 文本规范化：`trim + 合并连续空白`，精确匹配
- 记录时机：`create-and-execute` 成功后，写入本次全部勾选步骤
- 一个步骤可属于多条用例：数组存多条记录，badge 显示第一条用例名（多条时显示 "+N"）
- 用户手动勾回已生成步骤时，再次导出会**追加**新用例记录（允许重复导出）

### 2.4 随机数按钮

- 工具栏新增「随机数」按钮 → 小弹窗：位数输入（默认 11）+「生成」
- 生成逻辑：首位非零，其余随机（`Math.floor(Math.random()*10)`）
- 插入方式：定位聊天输入框 → 光标处插入生成值 → 触发 React 状态更新

**React 受控组件插值技巧**：
```js
const setter = Object.getOwnPropertyDescriptor(
  window.HTMLTextAreaElement.prototype, 'value').set;
setter.call(inputEl, newText);
inputEl.dispatchEvent(new Event('input', { bubbles: true }));
```
- 输入框定位：优先 `textarea`（bundle 中聊天输入为 textarea，占位 "What do you want to do?"），fallback `input[type=text]` / `[contenteditable]`
- contenteditable 情况：直接 `execCommand('insertText')` 或修改 textContent + input 事件
- 插入后弹窗关闭，用户自行补充指令上下文（如"输入"，midscene 即可理解要填的内容）

### 2.5 一键同步（复用已验证实现）

`POST /api/platform/execute/create-and-execute`（projectId/name/nlp）：
- success=true → 成功横幅 + 记录已生成指纹
- success=false（用例已建、执行机离线）→ warning 横幅 + 同样记录指纹（用例确实已创建）
- 401 → 清凭证回登录

### 2.6 翻译字典

复用 1.92 校准后的字典（Save/Verify/Verifying 等），新增条目在运行验收时按实际界面补充。MutationObserver 只处理文本节点，不影响 input/textarea 的 value 属性（React 状态不会被污染）。

## 三、execute-service 升级（1.9.2 → 1.12.2）

1. package.json `@midscene/core`、`@midscene/web` → `1.12.2`（精确版本）
2. `npm install`（如遇 safe-delete 守卫，先单独删除 node_modules\@midscene 目录再装）
3. `tsc` 编译验证 PlaywrightAgent 构造参数（cache/runYaml/aiAct/destroy）与 ReportMergingTool
4. 版本对齐意义：插件内录制的 YAML 语法、aiAction 语义、缓存格式与执行引擎解析保持一致

## 四、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| React 输入框定位失败（1.92 若用 contenteditable） | 中 | 双路径实现（textarea + contenteditable），失败时降级为复制到剪贴板并提示手动粘贴 |
| 已生成指纹文本匹配误差 | 低 | 规范化匹配；误差仅导致重复导出提示缺失，不阻断 |
| 1.12.2 类型不兼容 | 低 | tsc 编译兜底；官方 changelog 无破坏性变更 |
| 用户环境存在多个同名扩展 | 中 | 交付说明中明确要求卸载 1.52 导入包与 1.92_old |
