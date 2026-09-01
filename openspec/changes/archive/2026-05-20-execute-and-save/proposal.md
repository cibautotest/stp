# Proposal: 执行&保存（异步执行）

## Why

当前创建测试页面的"执行"按钮语义不清，用户点击后系统会静默保存测试用例，然后同步等待执行结果（可能长达 5 分钟），前端界面处于阻塞状态，用户体验差。

execute-service 已具备成熟的异步执行能力（`/execute/async` 接口返回 202 Accepted，后端轮询 `/execute/:id/status` 获取进度），但前端流程未利用该能力。通过将按钮改为"执行&保存"，实现真正的异步执行流程：保存用例后立即返回，前端轮询状态，让用户看到实时执行进度。

## What Changes

- **前端**：将创建测试页面的"执行"按钮改为"执行&保存"
  - 点击后调用后端新增的 `POST /api/platform/cases/create-and-execute` 接口
  - 获取 `caseId` 和 `executionId` 后，通过网关轮询 `GET /api/execute/:id/status` 获取执行状态
  - 执行完成后回调 `POST /api/platform/callback/execution-result` 更新后端 TestCase 记录
- **后端**：新增 `POST /api/platform/cases/create-and-execute` 接口
  - 接收参数：`projectId`、`nlp`、`customYaml`（不含 `aiConfig`）
  - 编排逻辑：创建 TestCase 记录 → 调用 execute-service 异步执行 → 返回 caseId + executionId
- **网关**：新增路由 `/api/execute/**` → `http://localhost:3001/execute/`
- **前端轮询**：通过网关代理访问 execute-service，轮询执行状态，渲染实时进度

## Capabilities

### New Capabilities

- `async-execute-and-save`: 创建测试用例并异步执行。覆盖从前端点击到后端 TestCase 状态更新的完整链路。包括：创建用例接口、通过网关轮询执行状态、前端回调更新后端记录。

## Impact

- **后端**：platform-service 新增 Controller、Service、Model；修改 ExecutionCallbackController 适配新字段；EngineClient 新增异步执行 Feign 方法
- **网关**：gateway-service 新增 `/api/execute/**` 路由
- **前端**：views/create/index.vue 重写执行逻辑；api/cases.ts 新增接口；stores/cases.ts 新增方法；vite.config.ts 新增代理
- **无破坏性变更**：现有同步执行接口（`/api/update-and-execute`）保持不变
