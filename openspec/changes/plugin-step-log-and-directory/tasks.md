# 实施任务清单

## 后端配合

- [x] 1. `CreateAndExecuteRequest` 新增 `directoryId` 字段（@NotBlank @Size(max=64)）
- [x] 2. `CreateAndExecuteService.createAndExecute` 透传 `testCase.setDirectoryId(request.getDirectoryId())`
- [x] 3. `mvn -pl platform-service -am compile` 编译验证通过；已重启 Platform 生效；实测不带 directoryId 返回 400
- [x] 3.1 附带修复：前端 Vue 的 createAndExecute / runCaseAsync / 创建页面同步透传 directoryId（否则新校验会拒绝前端创建）

## 插件 — 步骤日志系统

- [x] 4. `auth.js` 新增 getDirectories/createDirectory API
- [x] 5. `export-test-case.js` 实现步骤日志：新 bubble 监听记录 running、antd 通知 "Execution failed" 标 failure、文本稳定 3s 关键词判定、按页面 URL 持久化
- [x] 6. 导出渲染改为读取步骤日志（不再抓 DOM），合并已生成指纹，按 失败/已生成/其余/running 规则渲染与默认勾选
- [x] 7. 新增「清空历史」按钮逻辑（清除当前 URL 日志）

## 插件 — 目录下拉

- [x] 8. 导出弹窗目录下拉：项目切换时加载、创建目录选项、按项目记忆上次选择、必选校验
- [x] 9. sendToPlatform 传 directoryId；同步成功后记录已生成指纹并即时更新徽章（保留步骤日志）
- [x] 10. index.html：新增目录下拉与创建目录输入、清空历史按钮、running 状态样式

## 验收与收尾

- [ ] 11. 手动验收（用户）：多轮 NLP → 导出全量步骤；二次导出已生成徽章；目录选择与创建；同步后 directory_id 非空
- [ ] 12. 归档变更（openspec archive，验收通过后）
