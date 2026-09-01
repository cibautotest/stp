import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import swagger from '@fastify/swagger';
import scalar from '@scalar/fastify-api-reference';
import { getConfig } from '../config.js';
import { logger, requestLogger } from '../utils/logger.js';
import type { Orchestrator } from '../core/orchestrator.js';
import type { ReportManager } from '../reports/manager.js';
import type { ExecutionStore } from '../store/execution-store.js';
import { WsManager } from '../progress/ws-manager.js';
import { SseManager } from '../progress/sse-manager.js';

// 路由
import { syncRoutes } from './routes/sync.js';
import { asyncRoutes } from './routes/async.js';
import { statusRoutes } from './routes/status.js';
import { cancelRoutes } from './routes/cancel.js';
import { mergeRoutes } from './routes/merge.js';
import { healthRoutes } from './routes/health.js';

export async function createServer(
  orchestrator: Orchestrator,
  reportManager: ReportManager,
  store: ExecutionStore,
  wsManager: WsManager,
  sseManager: SseManager,
): Promise<FastifyInstance> {
  const config = getConfig();
  const server = Fastify({ logger: false });

  // ── 请求日志 ──
  server.addHook('onRequest', requestLogger.hook);

  // ── 基础插件 ──
  await server.register(cors);
  await server.register(websocket);

  // ── OpenAPI / Swagger ──
  await server.register(swagger, {
    openapi: {
      info: {
        title: 'Execute Service API',
        description: '基于 Midscene + Playwright 的 AI 驱动自动化测试执行引擎',
        version: '1.0.0',
        contact: {
          name: 'Smart Testing Platform',
        },
      },
      servers: [
        {
          url: `http://localhost:${config.PORT}`,
          description: '本地开发环境',
        },
      ],
      tags: [
        { name: 'System', description: '系统相关端点' },
        { name: 'Execute', description: '测试执行相关端点' },
        { name: 'Report', description: '测试报告相关端点' },
        { name: 'Progress', description: '实时进度推送 (WebSocket / SSE)' },
      ],
      externalDocs: {
        description: 'Midscene 文档',
        url: 'https://midscenejs.com/',
      },
    },
  });

  // ── 全局错误处理 ──
  server.setErrorHandler((error, _request, reply) => {
    logger.error({ err: error }, '未捕获错误');
    const statusCode = (error as any).statusCode || 500;
    reply.code(statusCode).send({
      error: 'INTERNAL_ERROR',
      message: (error as any).message,
    });
  });

  // ── 路由 ──
  await healthRoutes(server);
  await syncRoutes(server as any, orchestrator);
  await asyncRoutes(server as any, orchestrator);
  await statusRoutes(server, orchestrator);
  await cancelRoutes(server, orchestrator);
  await mergeRoutes(server, reportManager, store);
  await sseManager.register(server);

  // WebSocket（需要 await register websocket 之后）
  await server.register(async (wsScope) => {
    wsManager.register(wsScope as any);
  });

  // ── Scalar API Reference (可视化文档) ──
  await server.register(scalar, {
    routePrefix: '/docs',
    configuration: {
      spec: {
        content: () => (server as any).swagger(),
      },
      theme: 'saturn',
      metaData: {
        title: 'Execute Service - API 文档',
      },
    },
  });

  return server;
}
