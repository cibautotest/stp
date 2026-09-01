import type { FastifyInstance } from 'fastify';
import type { Orchestrator } from '../../core/orchestrator.js';
import { cancelSchema } from '../schemas.js';
import { createLogger } from '../../utils/logger.js';
import {
  cancelParamsJsonSchema,
  cancelResponse200,
  cancelResponse400,
  errorResponse400,
} from '../openapi-schemas.js';

const log = createLogger('Route:Cancel');

export async function cancelRoutes(server: FastifyInstance, orchestrator: Orchestrator): Promise<void> {
  server.post('/execute/:executionId/cancel', {
    schema: {
      description: '取消指定执行ID的任务（支持取消排队中或正在执行的任务）',
      tags: ['Execute'],
      summary: '取消执行',
      params: cancelParamsJsonSchema,
      response: {
        200: cancelResponse200,
        400: cancelResponse400,
      },
    },
  }, async (request, reply) => {
    const params = cancelSchema.safeParse(request.params);
    if (!params.success) {
      log.warn({ errors: params.error.format() }, '取消执行请求参数校验失败');
      return reply.code(400).send({ error: 'VALIDATION_ERROR', details: params.error.format() });
    }

    log.info({ executionId: params.data.executionId }, '收到取消执行请求');
    const result = await orchestrator.cancel(params.data.executionId);
    if (result.success) {
      log.info({ executionId: params.data.executionId }, '执行已取消');
      return reply.send(result);
    }
    log.warn({ executionId: params.data.executionId }, '取消执行失败（任务不存在或已完成）');
    return reply.code(400).send(result);
  });
}
