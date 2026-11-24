# 规格 — 步骤日志持久化与项目目录支持

## ADDED Requirements

### Requirement: 步骤日志自动记录

插件 SHALL 监听对话区域 DOM 变化，在每次新的用户指令（`.user-message-bubble`）出现时，将该指令文本记录为一条步骤日志（status=running）。日志 SHALL 按当前页面 URL 分组持久化于 localStorage，刷新插件、重启浏览器后 SHALL 保留。

#### Scenario: 连续输入多轮指令

- **WHEN** 用户依次输入 3 条 NLP 指令并回车执行
- **THEN** 步骤日志含 3 条记录（按时间序），与对话 DOM 是否被清除无关

### Requirement: 执行成败自动判定

插件 SHALL 通过两层信号判定每轮指令的执行结果并更新日志状态：

1. 检测到含 "Execution failed" 的通知元素时，最新一条 running 记录 SHALL 标记为 failure
2. 该轮响应文本稳定 3 秒后，含 failed/失败/error/错误/cannot/unable 关键词 SHALL 标记为 failure，否则 SHALL 标记为 success

#### Scenario: 一轮执行失败

- **WHEN** 某轮指令执行失败
- **THEN** 对应日志记录状态更新为 failure

### Requirement: 导出弹窗读取日志统一展示

点击「导出步骤」时，插件 SHALL 读取当前 tab URL 对应的全部步骤日志并展示（不再从对话 DOM 抓取）。默认勾选规则：

- failure 步骤：红色 ✗，默认不勾选
- 已生成过用例的步骤（按项目维度指纹匹配）：黄色徽章"已生成: 用例名"，默认不勾选
- 其余步骤：默认勾选
- running（未确认结果）步骤：蓝色 ⏳ 标注，默认勾选

所有步骤用户 SHALL 可手动改选。

#### Scenario: 第二次导出

- **WHEN** 用户生成用例 A（含步骤 1-3）后输入步骤 4-6，再次打开导出弹窗
- **THEN** 列表显示 6 条步骤：步骤 1-3 带"已生成: 用例A"徽章默认不选，步骤 4-6 默认选

### Requirement: 清空历史

导出弹窗 SHALL 提供「清空历史」按钮，点击后清除当前页面 URL 的全部步骤日志（不影响已生成用例指纹与平台数据）。

### Requirement: 项目目录选择与创建

导出弹窗 SHALL 在"项目名称"下方提供"项目目录"下拉框：

- 选中项目后 SHALL 调用 `GET /api/platform/case-directories?projectId=` 加载目录列表
- 下拉 SHALL 提供"➕ 创建目录…"选项，选择后展开输入框，确认后调用 `POST /api/platform/case-directories` 创建并自动选中新目录
- 插件 SHALL 按项目记忆上次选择的目录（localStorage）
- 项目下无目录时，下拉 SHALL 仅显示创建选项

#### Scenario: 未选目录禁止生成

- **WHEN** 用户未选择目录点击「生成用例」
- **THEN** 显示错误提示"请选择项目目录"，不发起同步请求

### Requirement: 同步携带目录（后端配合）

`POST /api/platform/execute/create-and-execute` 的请求体 SHALL 支持 `directoryId` 字段（必填，长度 ≤ 64），服务端 SHALL 将其写入新创建用例的 `directory_id` 字段。

#### Scenario: 同步后用例归属目录

- **WHEN** 插件携带 directoryId 调用 create-and-execute
- **THEN** 平台新用例的 directory_id 等于传入值（非 null）
