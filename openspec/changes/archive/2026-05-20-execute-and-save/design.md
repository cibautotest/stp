# Design: 执行&保存（异步执行）

## Context

### 当前状态

- 平台采用 Spring Cloud 微服务架构，主要组件：
  - **gateway-service** (port 8080)：统一网关，路由到各微服务
  - **platform-service** (port 8081)：核心业务服务，管理项目、用例、报告
  - **execute-service** (port 3001)：测试执行引擎，基于 Fastify/TypeScript，负责 yaml 脚本的异步执行
- 当前创建测试页面（`views/create/index.vue`）点击"执行"时：
  1. 前端先调用 `caseStore.addCase()` 保存用例
  2. 再调用 `caseStore.runCase()` → `POST /api/platform/update-and-execute`（同步阻塞）
  3. 同步等待 Engine 返回结果，超时可达 5 分钟

### 目标状态

用户点击"执行&保存"后，前端立即显示执行状态，引擎异步处理，后端 TestCase 记录在执行完成后自动更新。

## Goals / Non-Goals

**Goals:**
- 将"执行"按钮改为"执行&保存"，语义清晰
- 实现真正的异步执行，前端不阻塞，可实时看到执行进度
- 执行完成后，后端 TestCase 记录的 `status`、`htmlReportPath`、`executedAt` 字段自动更新
- 前端通过网关代理访问 execute-service，不直连 3001 端口

**Non-Goals:**
- 不修改现有的同步执行接口（`/api/update-and-execute`）
- 不修改 execute-service 的内部逻辑
- 不引入 WebSocket 连接（保持轮询方式）
- 不支持 AI 配置参数（`aiConfig` 暂不纳入本次范围）

## Decisions

### Decision 1: 网关转发 vs 直连

**选择：通过网关 `/api/execute/**` 转发到 execute-service**

- 网关现有路由 `/api/engine/**` 已指向 `http://localhost:3001`，但路径前缀为 `/api/engine`
- execute-service 实际路由为 `/execute/async` 和 `/execute/:id/status`
- **新增路由**：`/api/execute/**` → `http://localhost:3001/execute/`（RewritePath 去掉 `/api/execute` 前缀）

### Decision 2: 前端轮询 vs SSE

**选择：前端轮询 `GET /api/execute/:id/status`**

- SSE 需要 execute-service 维护长连接，对简单轮询场景过重
- 轮询间隔 3 秒，超时 300 秒（对齐后端 readTimeout）
- 前端在轮询过程中通过日志组件展示实时状态

### Decision 3: 执行完成后更新 DB 的方式

**选择：前端执行完成后回调 `POST /api/platform/callback/execution-result`**

- execute-service 异步执行完成后不会主动回调 platform-service
- 前端在轮询到 `status=completed/failed` 后，主动调用回调接口
- 后端 `ExecutionCallbackController` 已具备该能力，需适配新字段格式

### Decision 4: 请求参数设计

**最终参数：**
```
POST /api/platform/cases/create-and-execute
{
  "projectId": "string (required)",
  "nlp": "string (required)",
  "customYaml": "string (optional, overrides generated yaml)"
}
```
- 不包含 `aiConfig`（用户要求排除）
- `name` 字段：从 `nlp` 取第一行作为用例名称

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  FRONTEND (Vue3)                                                     │
│                                                                      │
│  [执行&保存 按钮] ──▶ handleExecuteAndSave()                          │
│      │                                                              │
│      ├── 1) POST /api/platform/cases/create-and-execute             │
│      │   { projectId, nlp, customYaml }                              │
│      │   ◀── { caseId, executionId }  (HTTP 201)                    │
│      │                                                              │
│      ├── 2) 轮询 GET /api/execute/:id/status                         │
│      │   (通过网关 → execute-service:3001)                           │
│      │   ◀── { status, progress, reportUrl }                        │
│      │   [展示日志 / 进度条]                                          │
│      │                                                              │
│      └── 3) status=completed/failed 时:                               │
│          POST /api/platform/callback/execution-result                │
│          { caseId, executionId, status, reportUrl }                  │
│          [更新 TestCase DB 记录]                                     │
└────────────────────────────────────────────────────────────────────┘
```

## Key API Changes

### 后端新增

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/platform/cases/create-and-execute` | 创建用例 + 异步执行编排 |
| GET | `/execute/:id/status` | 查询执行状态（execute-service）|
| POST | `/api/platform/callback/execution-result` | 前端回调更新 TestCase |

### 网关新增

```yaml
- id: execute-async
  uri: http://localhost:3001
  predicates:
    - Path=/api/execute/**
  filters:
    - RewritePath=/api/execute/(?<segment>.*), /execute/${segment}
```

## File Changes

### 后端（platform-service）

| 操作 | 文件 |
|------|------|
| 新增 | `model/CreateAndExecuteRequest.java` |
| 新增 | `model/CreateAndExecuteResponse.java` |
| 新增 | `service/CreateAndExecuteService.java` |
| 新增 | `controller/CreateAndExecuteController.java` |
| 修改 | `feign/EngineClient.java` — 新增 `asyncExecute()` Feign 方法 |
| 修改 | `feign/EngineClientFallback.java` — 新增 async fallback |
| 修改 | `controller/ExecutionCallbackController.java` — 适配 `executionId` + `reportUrl` 字段 |

### 网关（gateway-service）

| 操作 | 文件 |
|------|------|
| 修改 | `application.yml` — 新增 `/api/execute/**` 路由 |

### 前端（frontend）

| 操作 | 文件 |
|------|------|
| 修改 | `views/create/index.vue` — 按钮文案 + handleExecuteAndSave 重写 |
| 修改 | `api/cases.ts` — 新增 `createAndExecute()` |
| 修改 | `stores/cases.ts` — 新增轮询 + 回调逻辑 |
| 修改 | `vite.config.ts` — 新增 `/api/execute` 代理（dev 模式下需配置）|

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 前端轮询频繁增加网关/引擎负载 | 间隔 3 秒，最大 300 秒，可接受 |
| execute-service 挂了，前端轮询一直 pending | 设置最大重试次数（100 次），超时后提示失败 |
| 用户重复点击"执行&保存" | 执行中禁用按钮，或防抖处理 |
| 页面刷新丢失执行状态 | 状态仅保留在内存，刷新后需重新执行 |

## Open Questions

1. 执行中页面刷新后，已保存的 TestCase 记录状态仍为 PENDING，是否需要清理？
2. 执行日志是否需要持久化？还是仅在执行终端实时展示？
