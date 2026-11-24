# 插件步骤日志持久化 + 项目目录层级支持

## 变更概述

解决定制插件的两个结构性问题：① 官方 UI 单轮清除对话导致导出步骤永远只有 1 条、已生成标记随之失效；② 平台新增"项目-目录-用例"层级后，插件导出的用例缺少目录归属。方案：插件自维护持久化步骤日志（记录每轮 NLP 及执行成败，不再依赖 DOM）+ 导出弹窗新增必选的项目目录下拉（数据与平台同步、支持创建目录）+ 后端 create-and-execute 透传 directoryId。

## 背景与问题

### 问题 1：导出步骤只有 1 条（对话清除）
1.92 官方 Playground 每次 enter 发送新指令会清空对话历史（`.user-message-bubble` 仅剩最新 1 条），导致导出弹窗步骤列表永远只有 1 条。

### 问题 2：已生成标记"消失"
已生成指纹按 DOM 提取的步骤文本匹配——对话清除后旧步骤不再出现在列表中，标记无从挂载（localStorage 记录实际仍在）。用户期望：哪些步骤失败、哪些步骤已归入哪些用例，全部本地持久化记录。

### 问题 3：目录层级缺失
平台新增 `case_directories` 表（项目-目录-用例），`TestCase.directoryId` 为 @NotBlank 必填，但 `CreateAndExecuteRequest` 无 directoryId 字段，create-and-execute 绕过 Controller 校验直接 save，产生 directoryId=null 的隐患数据。插件导出需要：选择项目后加载该项目目录下拉（数据与平台同步）、提供创建目录选项、目录必选。

### 附带发现
1.52 的失败检测关键词 "Task failed" 在 1.92 bundle 中已不存在；1.92 的失败信号为 antd 通知 "Execution failed"。

## 目标

1. **步骤日志系统**：监听每轮 user-message-bubble 出现 → 记录 {text, status:running}；antd 通知含 "Execution failed" → 标 failure；响应文本稳定 3 秒 → 关键词判定 success/failure。按页面 URL 分组持久化（localStorage），导出时按当前 tab URL 读取全部轮次。
2. **导出默认勾选规则**：失败 → 红 ✗ 不选；已生成 → 黄徽章"已生成: 用例名"不选；其余 → 默认选（均可手动改选）。
3. **清空历史**：导出弹窗提供"清空历史"按钮，清除当前页面 URL 的步骤日志。
4. **项目目录下拉**：选中项目后加载 `GET /api/platform/case-directories?projectId=`；提供"➕ 创建目录"选项（POST 创建后自动选中）；记住上次选择（按项目）；必选。
5. **后端透传**：`CreateAndExecuteRequest` 新增 directoryId（@NotBlank），`CreateAndExecuteService` 透传到 TestCase。

## 非目标

- 不修改官方 bundle；不改官方对话清除行为
- 不做目录的树形（parentId）展示（下拉平铺即可，平台目录通常为一级）
- 不支持编辑/删除目录（平台侧已有删除接口，插件侧只读列表 + 创建）

## 验收标准

1. 连续输入多轮 NLP 后，导出弹窗显示全部轮次步骤（含每轮成功/失败标记，失败默认不选）
2. 生成用例 A 后继续输入新指令，再次导出时：用例 A 的步骤带"已生成: A"徽章默认不选，新步骤正常默认选；刷新插件后状态保持
3. 导出弹窗的项目目录下拉与平台目录数据一致；可创建目录并自动选中；未选目录时无法生成
4. 一键同步后，平台用例的 directoryId 正确写入（非 null）
