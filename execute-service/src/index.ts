import { getConfig } from './config.js';
import { logger } from './utils/logger.js';
import { getQueue } from './queue/factory.js';
import { progressBus } from './progress/bus.js';
import { wsManager } from './progress/ws-manager.js';
import { sseManager } from './progress/sse-manager.js';
import { CancelManager } from './core/cancel-manager.js';
import { Orchestrator } from './core/orchestrator.js';
import { ExecutionStore } from './store/execution-store.js';
import { ReportManager } from './reports/manager.js';
import { startCleanupJob } from './reports/cleanup.js';
import { createServer } from './api/server.js';

async function main(): Promise<void> {
  const config = getConfig();

  logger.info({ config: { ...config, REDIS_URL: '***' } }, '执行引擎启动中...');

  // ── 初始化模块 ──
  const queue = getQueue();
  const cancelManager = new CancelManager();
  const store = new ExecutionStore();
  const reportManager = new ReportManager();
  const orchestrator = new Orchestrator(
    queue,
    progressBus,
    cancelManager,
    store,
    reportManager,
  );

  // ── 启动报告清理定时任务 ──
  startCleanupJob(reportManager);

  // ── 创建 HTTP 服务 ──
  const server = await createServer(
    orchestrator,
    reportManager,
    store,
    wsManager,
    sseManager,
  );

  // ── 启动 ──
  await server.listen({ port: config.PORT, host: config.HOST });

  logger.info(`
  ╔══════════════════════════════════════════════════╗
  ║     Execute Service 已启动                        ║
  ╠══════════════════════════════════════════════════╣
  ║  HTTP:      http://${config.HOST}:${config.PORT}
  ║  Health:    http://${config.HOST}:${config.PORT}/health
  ║  Sync:      POST /execute/sync
  ║  Async:     POST /execute/async
  ║  Status:    GET  /execute/:id/status
  ║  Cancel:    POST /execute/:id/cancel
  ║  Report:    uploaded to Platform Service after execution
  ║  WS:        ws://${config.HOST}:${config.PORT}/ws/progress?executionId=xxx
  ║  SSE:       http://${config.HOST}:${config.PORT}/sse/progress?executionId=xxx
  ╠══════════════════════════════════════════════════╣
  ║  Queue:     ${config.QUEUE_TYPE.padEnd(36)}
  ║  Workers:   ${String(config.WORKER_CONCURRENCY).padEnd(36)}
  ║  Reports:   ${config.REPORT_DIR.padEnd(36)}
  ╚══════════════════════════════════════════════════╝
  `);
}

main().catch((err) => {
  logger.error({ err }, '启动失败');
  process.exit(1);
});
