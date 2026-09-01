## Why

本次会话中修复了多个跨模块的 Bug 和体验问题，这些问题分散在不同的执行路径上，需要一个统一的 change 来记录和追踪。

## What Changes

- **headful 浏览器可视化模式修复**：用例管理页面执行已有用例时，headless 参数未从配置读取，后端硬编码为 true，导致即使配置了"有界面模式"也弹不出浏览器窗口。修复整条调用链：前端 API → Store → 页面 → 后端 Controller → Service
- **页面切换动画增强**：动画从 0.15s/6px 调整为 0.3s/12px，使页面过渡更明显
- **测试计划添加用例去重**：打开"添加用例"对话框时自动排除计划已有的用例；穿梭框替换为自定义卡片式双列布局
- **execute-service 浏览器引擎修复**：从 Playwright 内置 Chromium 改用系统 Chrome（`channel: 'chrome'`），解决 Windows 环境下 `Executable doesn't exist` 问题
- **登录页默认账号提示删除**：移除硬编码的账号提示，提升安全性

## Capabilities

### Modified Capabilities
- `test-case-management`: 执行已有用例时透传 headless 配置
- `test-execution-engine`: 浏览器启动改用系统 Chrome channel
- `test-plan-management`: 添加用例对话框去重逻辑和 UI 优化

## Impact

- **前端**: `cases/index.vue`, `plans/index.vue`, `App.vue`, `login/index.vue`, `api/cases.ts`, `stores/cases.ts`
- **后端**: `ExecuteController.java`, `CaseExecutionService.java`
- **execute-service**: `yaml-runner.ts`
