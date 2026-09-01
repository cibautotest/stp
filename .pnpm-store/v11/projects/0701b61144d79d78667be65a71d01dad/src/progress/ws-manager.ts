import type { WebSocket } from 'ws';
import type { FastifyInstance } from 'fastify';
import type { ProgressEvent } from '../models/progress.js';
import { progressBus } from './bus.js';
import { logger } from '../utils/logger.js';

interface WsClient {
  ws: WebSocket;
  executionId: string;
  alive: boolean;
}

export class WsManager {
  private clients = new Map<WebSocket, WsClient>();

  register(server: FastifyInstance): void {
    server.get('/ws/progress', { websocket: true }, (socket, req) => {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const executionId = url.searchParams.get('executionId');

      if (!executionId) {
        socket.close(1008, '缺少 executionId 参数');
        return;
      }

      const client: WsClient = { ws: socket, executionId, alive: true };
      this.clients.set(socket, client);

      // 进度事件监听
      const onProgress = (event: ProgressEvent) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify(event));
        }
      };
      progressBus.subscribe(executionId, onProgress);

      // 心跳
      const heartbeatTimer = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({
            type: 'heartbeat',
            executionId,
            timestamp: Date.now(),
          }));
        }
      }, 15000);

      socket.on('close', () => {
        clearInterval(heartbeatTimer);
        progressBus.unsubscribe(executionId, onProgress);
        this.clients.delete(socket);
        logger.debug({ executionId }, 'WebSocket 客户端断开');
      });

      socket.on('error', (err) => {
        logger.error({ err, executionId }, 'WebSocket 错误');
      });

      logger.info({ executionId }, 'WebSocket 客户端已连接');
    });
  }

  broadcast(executionId: string, event: ProgressEvent): void {
    for (const client of this.clients.values()) {
      if (
        client.executionId === executionId &&
        client.ws.readyState === client.ws.OPEN
      ) {
        client.ws.send(JSON.stringify(event));
      }
    }
  }
}

export const wsManager = new WsManager();
