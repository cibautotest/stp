# Tasks: 插件启动认证 & 导出流程简化

## 1. 启动认证覆盖层（index.html + export-test-case.js）

- [x] 1.1 新增登录覆盖层 HTML 结构
- [x] 1.2 新增登录覆盖层 CSS 样式
- [x] 1.3 登录按钮 → POST /auth/login
- [x] 1.4 密码错误提示
- [x] 1.5 登录成功 → token+username 存 localStorage，进入项目选择

## 2. 项目选择弹窗

- [x] 2.1 项目选择弹窗 HTML 结构
- [x] 2.2 GET /projects 渲染下拉
- [x] 2.3 创建新项目选项
- [x] 2.4 POST /projects 创建
- [x] 2.5 确认 → 保存 projectId/projectName 到 localStorage
- [x] 2.6 空列表引导

## 3. auth.js 认证模块

- [x] 3.1 封装 login/getProjects/createProject
- [x] 3.2 平台地址读取
- [x] 3.3 Token 过期 401 → 重登录

## 4. 导出弹窗简化

- [x] 4.1 移除账号/密码输入框
- [x] 4.2 项目名称改为 select 下拉
- [x] 4.3 用例名称 placeholder 简化
- [x] 4.4 测试网址：每次点击导出时实时获取当前标签页 URL
- [x] 4.5 buildClipboardText 移除 account/password
- [x] 4.6 validateForm 移除 account/password
- [x] 4.7 sendToPlatform 复用 _authToken + projectId
- [x] 4.8 saveFormValues 仅保存 projectId/testUrl

## 5. 初始化时序 & 状态机

- [x] 5.1 init 时从 localStorage 恢复 token → GET /auth/me 验证
- [x] 5.2 有效 → 跳过登录，进项目选择；过期 → 清 token，显示登录
- [x] 5.3 READY 状态才允许导出
- [x] 5.4 导出弹窗中项目下拉 + 新建逻辑

## 6. Token 持久化 & 登出

- [x] 6.1 登录成功 → token + username 存 localStorage
- [x] 6.2 启动时从 localStorage 恢复 token → GET /auth/me 验证有效性
- [x] 6.3 Token 有效 → 直接进 PROJECT_SELECT/READY，跳过登录
- [x] 6.4 Token 过期/无效 → 清除 localStorage，显示登录覆盖层
- [x] 6.5 工具栏显示 `用户: {username}`
- [x] 6.6 工具栏添加 `[登出]` 按钮 → 确认后清除 localStorage → 回到登录

## 7. 测试网址实时更新

- [x] 7.1 每次点击"导出全量用例步骤"时通过 chrome.tabs.query 实时获取当前 URL
- [x] 7.2 获取到的 URL 自动填入测试网址字段，用户可修改

## 8. 兼容性 & 测试（需手动验证）

- [ ] 8.1 首次登录 → token 持久化 → 关闭重开 → 自动恢复登录
- [ ] 8.2 点击登出 → 清除 → 回到登录
- [ ] 8.3 Token 过期 → 自动弹出登录
- [ ] 8.4 导出时测试网址为当前页 URL（每次点击都刷新）
- [ ] 8.5 密码错误提示和重试
- [ ] 8.6 sysadmin/general 项目权限隔离
- [ ] 8.7 修改 zip → public/plugin/ → 中台下载正常
