# 技术设计 — 步骤日志 + 目录层级

## 一、步骤日志系统（核心）

### 1.1 存储结构（localStorage，按页面 URL 分组）

```js
midscene_step_log = {
  "https://example.com/page": [
    { text: "输入xxx，点击搜索", status: "success", ts: 1693814400000 },
    { text: "点击不存在的按钮", status: "failure", ts: ... },
    { text: "正在执行的指令", status: "running", ts: ... }
  ]
}
```

- key 为当前 tab 的 URL（导出弹窗的"测试网址"同源），换页面自动隔离
- 与已生成指纹 `midscene_exported_steps`（按项目维度）相互独立、导出时合并标注

### 1.2 监听与判定（三层信号）

```
┌─ 信号 A：新指令出现 ──────────────────────────────┐
│ MutationObserver 监听 #root                        │
│ 新 .user-message-bubble 出现且文本非空              │
│ → appendStepLog(url, { text, status:'running' })   │
└────────────────────────────────────────────────────┘
┌─ 信号 B：失败通知（最可靠）────────────────────────┐
│ 观察 antd notification/toast 节点                  │
│ 文本含 "Execution failed"                          │
│ → 最新一条 running 记录 → status='failure'         │
└────────────────────────────────────────────────────┘
┌─ 信号 C：响应稳定判定 ─────────────────────────────┐
│ 该轮 assistant 响应区段文本稳定 3 秒（防抖）        │
│ 区段含 failed/失败/error/错误/cannot/unable        │
│   → status='failure'                               │
│ 否则 → status='success'                            │
└────────────────────────────────────────────────────┘
```

- running 记录在下一次导出时若仍为 running（中途刷新等），按"待判定"处理：默认勾选并标注"执行中/未确认"，用户自行判断
- 防抖判定复用现有 collectTextBetween 思路（该 bubble 到下一 bubble 之间的文本）

### 1.3 导出渲染合并规则

```
步骤日志（页面URL维度）  ×  已生成指纹（项目维度）
        │
        ▼
┌──────────────────────────────────────────┐
│ failure  → 红 ✗，默认不选                  │
│ exported → 黄徽章"已生成: 用例名"，默认不选   │
│ 其余     → 绿 ✓，默认选                     │
│ running  → 蓝 ⏳，默认选（用户自行判断）       │
└──────────────────────────────────────────┘
```

- 同步成功后：勾选步骤写入已生成指纹（追加），当前弹窗即时更新徽章；**步骤日志保留**（不删除，历史可追溯）
- 「清空历史」按钮：清除当前页面 URL 的 midscene_step_log 条目（不影响已生成指纹）

## 二、项目目录下拉

### 2.1 数据来源

- 列表：`GET /api/platform/case-directories?projectId=<id>`（Bearer），响应为 CaseDirectory[]（含 id/name/parentId）
- 创建：`POST /api/platform/case-directories`，body `{ projectId, name }`（不传 parentId，一级目录），201 返回新目录

### 2.2 交互

- 导出弹窗"项目名称"下新增"项目目录"下拉：
  - 选中项目 → 拉取目录列表填充
  - 底部固定"➕ 创建目录…"选项 → 展开输入框 → 创建成功后刷新列表并自动选中
  - 项目下无目录 → 下拉仅显示"➕ 创建目录…"（必选语义下强制创建）
  - localStorage 按项目记忆上次选择的目录（`midscene_directory_id_<projectId>`）
- 校验：目录必选，未选时报错"请选择项目目录"

### 2.3 后端透传

- `CreateAndExecuteRequest` 新增 `@NotBlank @Size(max=64) private String directoryId`
- `CreateAndExecuteService.createAndExecute`：`testCase.setDirectoryId(request.getDirectoryId())`
- 附带收益：修复此前 create-and-execute 产生 directoryId=null 隐患数据的问题

## 三、改动清单

| 文件 | 改动 |
|------|------|
| `backend/.../model/CreateAndExecuteRequest.java` | +directoryId 字段（@NotBlank） |
| `backend/.../service/CreateAndExecuteService.java` | 透传 directoryId |
| `插件/scripts/auth.js` | + getDirectories/createDirectory API |
| `插件/scripts/export-test-case.js` | 步骤日志系统（监听/判定/持久化）+ 导出渲染改为读日志 + 目录下拉逻辑 + 清空历史 + 同步传 directoryId |
| `插件/index.html` | 导出弹窗加目录下拉与创建目录输入、清空历史按钮、running 状态样式 |

## 四、风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| antd 通知 DOM 结构差异导致失败信号漏检 | 中 | 信号 C（文本稳定+关键词）兜底；用户可手动改选 |
| 文本稳定判定的误报（长任务中途停顿被误判完成） | 低 | 3 秒防抖 + 关键词双向判定；running 状态可见 |
| 已生成与日志文本规范化差异 | 低 | 统一 normalizeStepText；误差仅影响标记展示 |
| 目录必选但项目无目录 | 低 | 下拉仅"创建目录"选项，引导创建 |
