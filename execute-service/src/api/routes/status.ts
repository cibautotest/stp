import type { FastifyInstance } from 'fastify';
import type { Orchestrator } from '../../core/orchestrator.js';
import { statusParamsSchema } from '../schemas.js';
import { createLogger } from '../../utils/logger.js';
import {
  statusParamsJsonSchema,
  statusResponse200,
  errorResponse400,
  errorResponse404,
} from '../openapi-schemas.js';

const log = createLogger('Route:Status');

export async function statusRoutes(server: FastifyInstance, orchestrator: Orchestrator): Promise<void> {
  server.get('/execute/:executionId/status', {
    schema: {
      description: '查询指定执行ID的任务状态、进度、耗时等信息',
      tags: ['Execute'],
      summary: '查询执行状态',
      params: statusParamsJsonSchema,
      response: {
        200: statusResponse200,
        400: errorResponse400,
        404: errorResponse404,
      },
    },
  }, async (request, reply) => {
    const params = statusParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: params.error.format() });
    }

    try {
      const status = await orchestrator.getStatus(params.data.executionId);
      return reply.send(status);
    } catch (err) {
      log.warn({ executionId: params.data.executionId }, '查询执行状态失败（不存在）');
      return reply.code(404).send({
        error: 'NOT_FOUND',
        message: (err as Error).message,
      });
    }
  });
}
