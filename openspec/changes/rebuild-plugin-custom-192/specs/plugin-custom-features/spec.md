# 规格 — 插件定制能力（1.92_0 基底重建版）

## ADDED Requirements

### Requirement: 版本标识可见

插件侧边栏 SHALL 显示定制版本标识「测试用例可视化插件 v1.92」，且官方版本号（Midscene.js version / SDK 版本）SHALL NOT 被隐藏。

#### Scenario: 打开侧边栏

- **WHEN** 用户打开插件侧边栏
- **THEN** 工具栏显示「测试用例可视化插件 v1.92」，官方渲染的版本号文本保持可见

### Requirement: 用户登录与项目选择（沿用既有规格）

插件 SHALL 提供登录遮罩、项目选择/创建弹窗，对接 `POST /api/platform/auth/login`、`GET /api/platform/auth/me`、`GET /api/platform/projects?size=100`（读 items）、`POST /api/platform/projects`。token 持久化，重启插件经 `/auth/me` 静默恢复；失效则回登录态。

### Requirement: 失败步骤默认排除（沿用既有规格）

导出弹窗 SHALL 抓取 `.user-message-bubble` 步骤，默认全选；检测到失败特征（failed/✗/失败）的步骤自动标记红色 ✗ 并取消勾选，用户可手动改选。

### Requirement: 已生成用例步骤标记与默认排除

插件 SHALL 按项目维度记录已成功同步平台的步骤（规范化文本 + 用例名）。打开导出弹窗时：

- 命中已生成记录的步骤 SHALL 默认不勾选
- 步骤行 SHALL 显示黄色徽章，注明"已生成: <用例名>"（多条用例时显示首条 + "+N"）
- 用户 SHALL 可手动重新勾选；再次导出后 SHALL 追加记录（允许一步骤对应多用例）

#### Scenario: 二次导出排除已生成步骤

- **WHEN** 用户第 2 次打开导出弹窗，第 2 步已在上次成功导出到"登录用例A"
- **THEN** 第 2 步显示徽章"已生成: 登录用例A"且默认不勾选，其余步骤默认勾选

### Requirement: 随机数生成按钮

工具栏 SHALL 提供「随机数」按钮。点击后弹出小窗，用户输入位数（默认 11）并确认后：

- 生成指定位数随机数（首位非零）
- 自动插入当前聊天输入框（触发 input 事件使 React 状态同步），随后关闭弹窗
- 插入失败时降级为写入剪贴板并提示

#### Scenario: 生成 11 位随机数

- **WHEN** 用户点击随机数按钮，保持默认位数 11，点击生成
- **THEN** 聊天输入框内容变为原内容后追加 1 个 11 位随机数（首位非零）

### Requirement: 一键同步平台（沿用既有规格）

校验通过后调用 `POST /api/platform/execute/create-and-execute`；成功显示成功横幅并记录已生成指纹；success=false（执行机离线）显示警告横幅并同样记录指纹；401 清凭证回登录。

## MODIFIED Requirements

### Requirement: execute-service Midscene 依赖版本

`@midscene/core` 与 `@midscene/web` SHALL 锁定为 `1.12.2`（与插件 1.92 内置 SDK 版本对齐）。升级后 YAML 执行（runYaml）、NLP 执行（aiAct）、缓存（`cache: { id }`）、报告生成与合并 SHALL 保持正常（tsc 编译验证）。
