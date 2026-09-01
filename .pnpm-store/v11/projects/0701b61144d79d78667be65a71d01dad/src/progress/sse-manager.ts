import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ProgressEvent } from '../models/progress.js';
import { progressBus } from './bus.js';
import { logger } from '../utils/logger.js';

export class SseManager {
  register(server: FastifyInstance): void {
    server.get('/sse/progress', async (request, reply) => {
      const executionId = (request.query as any).executionId as string;

      if (!executionId) {
        reply.code(400).send({ error: '缺少 executionId 参数' });
        return;
      }

      // SSE 响应头
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      reply.raw.write('data: {"type":"connected","executionId":"' + executionId + '"}\n\n');

      const onProgress = (event: ProgressEvent) => {
        if (!reply.raw.destroyed) {
          reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      };

      progressBus.subscribe(executionId, onProgress);

      // 心跳
      const heartbeatTimer = setInterval(() => {
        if (!reply.raw.destroyed) {
          reply.raw.write(`: heartbeat\n\n`);
        }
      }, 15000);

      request.raw.on('close', () => {
        clearInterval(heartbeatTimer);
        progressBus.unsubscribe(executionId, onProgress);
        logger.debug({ executionId }, 'SSE 客户端断开');
      });

      logger.info({ executionId }, 'SSE 客户端已连接');
    });
  }
}

export const sseManager = new SseManager();
