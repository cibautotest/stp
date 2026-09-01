# Execute Service

基于 Midscene + Playwright 的自动化测试执行引擎，支持 YAML 脚本格式的 AI 驱动 UI 自动化测试。

## 架构

```
Test Case (YAML) → Execute Service → Midscene + Playwright → Browser
                        │
                        ├── 同步执行 (/execute/sync)
                        ├── 异步执行 (/execute/async)
                        ├── 进度推送 (WebSocket / SSE)
                        └── 报告生成 (HTML)
```

## 快速启动

```bash
# 安装依赖
pnpm install

# 安装 Playwright 浏览器
npx playwright install chromium

# 配置环境变量
cp .env.example .env

# 开发模式 (端口 3001)
pnpm run dev

# 生产构建 (端口 3001)
pnpm run build && pnpm start
```

## API

### 同步执行
```bash
POST /execute/sync
Content-Type: application/json

{
  "id": "TC-001",
  "name": "搜索功能验证",
  "yamlScript": "target:\n  url: https://www.baidu.com\ntasks:\n  - name: 搜索\n    flow:\n      - ai: 搜索 '天气'\n      - aiAssert: 显示搜索结果"
}
```

### 异步执行
```bash
POST /execute/async
# 同上请求体，返回 { executionId, status: "queued" }
```

### 查询状态
```bash
GET /execute/{executionId}/status
```

### 取消执行
```bash
POST /execute/{executionId}/cancel
```

### 查看报告
```bash
GET /reports/{executionId}
```

### 进度推送
```bash
# WebSocket
ws://localhost:3001/ws/progress?executionId={id}

# SSE
http://localhost:3001/sse/progress?executionId={id}
```

## 进度事件

| 事件类型 | 说明 |
|---------|------|
| `queued` | 已入队 |
| `started` | 开始执行 |
| `step_start` | 步骤开始 |
| `step_progress` | 子任务进度（来自 Midscene） |
| `step_complete` | 步骤完成 |
| `completed` | 全部完成 |
| `failed` | 执行失败 |
| `cancelled` | 已取消 |

## YAML 格式

```yaml
target:
  url: https://www.example.com
  viewportWidth: 1280
  viewportHeight: 960

tasks:
  - name: 任务名称
    continueOnError: false
    flow:
      - ai: 点击登录按钮
      - aiAction: 输入用户名
      - sleep: 1000
      - aiAssert: 页面显示欢迎信息
      - aiQuery: "{ items: { title: string }[] }"
        name: productList
      - aiWaitFor: 加载完成
        timeout: 10000
```

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `PORT` | 3001 | 服务端口 |
| `QUEUE_TYPE` | memory | 队列类型 (memory/redis) |
| `WORKER_CONCURRENCY` | 3 | 并发 Worker 数 |
| `EXECUTION_TIMEOUT_MS` | 120000 | 执行超时 |
| `REPORT_MAX_AGE_DAYS` | 90 | 报告保留天数 |
# API 流量观测与染色配置

执行端在框架层安装 Playwright BrowserContext 网络观测器，执行用户和 YAML/NLP 脚本不需要感知，也不需要在脚本里写拦截、注入 header 或发送 Kafka 的逻辑。

`OBSERVABILITY_ENABLED=true` 后，执行端会对浏览器业务 `fetch/xhr` 请求写入 `sw8`、`x-test-execution-id` 和 `x-test-request-id`，并采集请求/响应交换。`OBSERVABILITY_API_HOSTS` 为空时采集全部 `fetch/xhr`，否则只采集逗号分隔的 host。

```powershell
$env:OBSERVABILITY_ENABLED="true"
$env:OBSERVABILITY_API_HOSTS="api.example.com,api.example.com:8443"
```

Kafka 配置可由 Platform Service 每次执行随任务下发；如果未下发，执行端会使用本地环境变量作为框架默认配置：

```powershell
$env:OBSERVABILITY_KAFKA_ENABLED="true"
$env:KAFKA_BOOTSTRAP_SERVERS="kafka-1:9092,kafka-2:9092"
$env:KAFKA_TOPIC="ui-test-api-exchange.v1"
$env:KAFKA_CLIENT_ID="smart-testing-execute"
```
