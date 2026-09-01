# Proposal: 平台上手体验与文档标准化

> **状态**: 已完成 | **创建日期**: 2026-05-22 | **版本**: v1

---

## Why

智能测试中台面向两类受众：**开发者**（需要快速搭建和二次开发）和**测试人员**（需要用自然语言编写测试用例）。当前文档存在以下问题：

1. **README 缺乏新手指引**：没有平台能做什么、怎么工作的概念性介绍，对项目零认知的人无法快速上手
2. **启动命令过时**：README 中的启动命令与实际可用的 `.bat` / `pnpm` 脚本不一致
3. **缺少默认账号信息**：没有说明预置的登录账号和初始密码
4. **子服务 README 信息不一致**：execute-service 端口写的是 3000，实际是 3001；前端 README 用的是 npm，实际项目用 pnpm
5. **缺少工作流程描述**：用户不知道从登录到完成一次测试的完整步骤

这些问题导致新加入的开发者或测试人员需要额外沟通才能启动项目，降低了团队的自主上手率。

## What Changes

### README.md 全面增强
- 新增「项目简介」章节：解释平台是什么、怎么工作、适用场景
- 新增「核心功能」章节：按模块（用例管理/测试计划/数据看板/执行引擎/用户权限/AI配置/插件生态）列出功能清单
- 新增「整体架构」章节：ASCII 架构图 + 5 条架构要点解读
- 新增「工作流程」章节：6 步端到端使用流程图
- 新增「默认账号」章节：sysadmin / testuser 的账号密码及权限说明
- 增强「技术栈」：从 9 行简表扩展为 22 行四列分层级表格
- 增强「项目结构」：补全 frontend 完整目录树 + 后端分层详情
- 更新「本地开发」启动命令：前端用 `pnpm run dev`、后端用 `.\restart-backend.bat`、执行服务用 `pnpm start`

### 子文档同步
- `frontend/README.md`：npm → pnpm（install / dev / build / preview）
- `execute-service/README.md`：npm → pnpm；端口 3000 → 3001（启动命令 + WebSocket/SSE + 配置表）

### 插件更新说明
- 在 README 主文档新增插件更新流程：修改 `Midscene.js 1.52` → 手动 zip → 放至 `frontend/public/plugin` → 重命名为 `midscene-extension.zip`

## Capabilities

- **platform-onboarding**: 项目文档标准化，新开发者/测试人员能通过 README 自主完成环境搭建和首次使用

## Non-Goals

- 不修改任何后端业务代码或 API 接口
- 不修改前端页面功能逻辑（仅调整文案和样式已在 plugin-integration 中跟踪）
- 不新增自动化部署脚本（本次仅规范文档）

## Impact

| 层级 | 影响范围 | 性质 |
|------|----------|------|
| README.md | 重写约 70% 内容 | 文档增强 |
| frontend/README.md | pnpm 命令同步 | 维护性修正 |
| execute-service/README.md | pnpm + 端口同步 | 维护性修正 |
| 开发者体验 | 新人可自主上手 | 体验提升 |
| OpenSpec | 新增 platform-onboarding 变更记录 | 归档 |
