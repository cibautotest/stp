import type { FastifyInstance } from 'fastify';
import { healthResponse200 } from '../openapi-schemas.js';

export async function healthRoutes(server: FastifyInstance): Promise<void> {
  server.get('/health', {
    schema: {
      description: '服务健康检查端点，返回运行状态和运行时长',
      tags: ['System'],
      summary: '健康检查',
      response: {
        200: healthResponse200,
      },
    },
  }, async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}
