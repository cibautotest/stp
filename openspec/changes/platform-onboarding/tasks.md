# Tasks: 平台上手体验与文档标准化

---

## 1. 主 README.md — 概念性章节

- [x] 1.1 新增「项目简介」：平台是什么、怎么工作、适用场景（3 段）
- [x] 1.2 新增「核心功能」：7 个功能模块详细展开（用例管理/测试计划/数据看板/执行引擎/用户权限/AI配置/插件生态）
- [x] 1.3 新增「整体架构」：ASCII 分层架构图 + 5 条架构要点解读
- [x] 1.4 新增「工作流程」：6 步端到端使用流程图（登录→项目→AI配置→用例→执行→报告）

## 2. 主 README.md — 快速开始章节

- [x] 2.1 更新「本地开发」启动命令（前端 pnpm、后端 .bat、执行服务 3001）
- [x] 2.2 新增「默认账号」表格（sysadmin + testuser 的账号密码及权限说明）
- [x] 2.3 新增「插件更新说明」（Midscene.js 1.52 修改 → zip → public/plugin → midscene-extension.zip）
- [x] 2.4 保留并调整「访问地址」表格式

## 3. 主 README.md — 参考章节增强

- [x] 3.1 增强「技术栈」表格：从 9 行 → 22 行，四列分层级（前端/后端/微服务/执行引擎/部署）
- [x] 3.2 增强「项目结构」：补全 frontend 完整目录树（10 个页面子目录）+ 后端 controller/service/entity 分层详情
- [x] 3.3 保留所有原有内容（环境要求、服务端口、API 文档、License）

## 4. 子文档同步

- [x] 4.1 `frontend/README.md`：npm → pnpm（install/dev/build/preview 共 4 处）
- [x] 4.2 `execute-service/README.md`：npm → pnpm（快速启动共 3 处）
- [x] 4.3 `execute-service/README.md`：端口 3000 → 3001（快速启动 + WebSocket + SSE + 配置表共 4 处）
