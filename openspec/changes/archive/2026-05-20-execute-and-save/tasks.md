# Tasks: 执行&保存（异步执行）

## 1. 后端 — Model & Feign

- [x] 1.1 新增 `model/CreateAndExecuteRequest.java`（字段：projectId, nlp, customYaml）
- [x] 1.2 新增 `model/CreateAndExecuteResponse.java`（字段：caseId, executionId）
- [x] 1.3 在 `feign/EngineClient.java` 新增 `asyncExecute()` 方法，调用 `POST /execute/async`
- [x] 1.4 在 `feign/EngineClientFallback.java` 新增 asyncExecute 的 fallback 实现

## 2. 后端 — Service & Controller

- [x] 2.1 新增 `service/CreateAndExecuteService.java`：编排创建 TestCase → 调用 execute-service async → 返回
- [x] 2.2 新增 `controller/CreateAndExecuteController.java`：暴露 `POST /api/platform/cases/create-and-execute`
- [x] 2.3 修改 `ExecutionCallbackController.java`：适配 `executionId` 和 `reportUrl` 字段（现有是 taskId/reportPath）

## 3. 网关配置

- [x] 3.1 在 `gateway-service/src/main/resources/application.yml` 新增路由：`/api/execute/**` → `http://localhost:3001`，RewritePath 去除 `/api/execute` 前缀

## 4. 前端 — API 层

- [x] 4.1 在 `api/cases.ts` 新增 `createAndExecute()` 方法，调用 `POST /api/platform/cases/create-and-execute`
- [x] 4.2 在 `vite.config.ts` 新增开发环境代理：`/execute` → `http://localhost:8080`（通过网关）

## 5. 前端 — Store

- [x] 5.1 在 `stores/cases.ts` 新增 `runCaseAsync()` 方法：调用 createAndExecute → 轮询 `/api/execute/:id/status` → 执行完成后回调 `/api/platform/callback/execution-result`

## 6. 前端 — 页面

- [x] 6.1 修改 `views/create/index.vue` 按钮文案："执行" → "执行&保存"
- [x] 6.2 重写 `handleExecute()` 为 `handleExecuteAndSave()`：调用 store.runCaseAsync()，处理 loading/error/complete 状态，展示执行日志
- [x] 6.3 执行中禁用按钮，完成后恢复
