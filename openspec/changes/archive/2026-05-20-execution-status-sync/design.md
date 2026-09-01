## Context

当前 `platform-service` 调用 `execute-service` 的异步执行接口后，缺乏状态同步机制。异步执行结果依赖前端轮询或回调通知才能更新到数据库，导致：
- 用例状态滞后：用户看不到实时执行进度
- 回调失败风险：网络问题导致回调丢失，状态永远停留在 `RUNNING`
- 前端实现复杂：需要前端自己处理轮询逻辑

## Goals / Non-Goals

**Goals:**
- 后端定时任务自动轮询 `execute-service` 状态，同步更新到 `TestCase` 和 `Report` 表
- 提供 `ExecutionRecord` 实体，存储 `executionId` → `caseId` 映射
- 统一状态枚举：`PENDING` / `RUNNING` / `SUCCESS` / `FAILED` / `UNKNOWN`
- 前端用例列表展示状态，新增报告链接入口

**Non-Goals:**
- 不实现 WebSocket/SSE 实时推送（方案 C 过于复杂）
- 前端不实现实时状态轮询，只展示后端同步后的状态
- 不修改 `execute-service` 的任何代码

## Decisions

### 决策 1：定时任务轮询间隔 10 秒

选择每 10 秒扫描一次 `RUNNING` 状态的用例。

**替代方案：**
- 5 秒：响应更快，但增加 `execute-service` 压力
- 30 秒：压力更小，但状态更新延迟明显

**结论**：10 秒是响应速度与系统负载的平衡点。

### 决策 2：使用独立 `ExecutionRecord` 表

存储 `executionId` → `caseId` 映射，而非直接在 `TestCase` 中增加字段。

**替代方案：**
- 将 `executionId` 直接存在 `TestCase` 表：`caseId` 唯一约束冲突（同一用例可多次执行）
- 只扫描 `Report` 表：`Report` 是执行结果存档，不适合作为轮询入口

**结论**：`ExecutionRecord` 专门管理执行会话，职责清晰。

### 决策 3：状态枚举映射

| execute-service 状态 | 映射后状态 |
|---------------------|-----------|
| `pending` / `queued` | `RUNNING` |
| `running` | `RUNNING` |
| `completed` | `SUCCESS` |
| `failed` | `FAILED` |
| `cancelled` | `FAILED` |
| 其他 | `UNKNOWN` |

### 决策 4：Report 表作为执行记录持久化

每次状态同步（`completed` / `failed`）时，写入一条新 `Report` 记录。`TestCase.htmlReportPath` 指向最新报告路径。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `execute-service` 无响应 | 状态保持 `RUNNING`，定时任务报错 | 捕获异常，记录日志，继续轮询 |
| 多实例部署定时任务重复轮询 | 重复更新数据库 | 使用分布式锁（简单场景可接受重复覆盖更新） |
| 前端状态显示延迟最长 10 秒 | 用户体验略差 | 接受，用户可手动刷新页面 |
| `executionId` 丢失（系统重启） | 历史执行状态无法追踪 | 仅影响崩溃前的执行，不影响新执行 |

## Migration Plan

1. **Phase 1**: 新增 `execution_record` 表（向后兼容，无需迁移）
2. **Phase 2**: 实现 `ExecutionRecord` 实体和 Mapper
3. **Phase 3**: 修改执行服务，在调用异步执行后创建 `ExecutionRecord`
4. **Phase 4**: 实现 `ExecutionStatusSyncService` 定时任务
5. **Phase 5**: 前端添加状态列和报告按钮

**回滚策略**：删除定时任务 Bean，保留 `ExecutionRecord` 表（不影响现有功能）

## Open Questions

1. 执行超时如何处理？（当前 execute-service 没有超时兜底）
2. 多次执行同一用例时，旧 `ExecutionRecord` 是否需要清理？
