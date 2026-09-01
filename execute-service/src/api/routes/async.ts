import type { FastifyInstance } from 'fastify';
import type { Orchestrator } from '../../core/orchestrator.js';
import { executeAsyncSchema } from '../schemas.js';
import { AppError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';
import {
  executeSyncBodySchema,
  executeAsyncResponse202,
  errorResponse400,
  errorResponse500,
} from '../openapi-schemas.js';

const log = createLogger('Route:Async');

export async function asyncRoutes(server: FastifyInstance, orchestrator: Orchestrator): Promise<void> {
  server.post('/execute/async', {
    schema: {
      description: '异步执行测试用例 — 立即返回 executionId，通过 WebSocket/SSE 或 GET /execute/:id/status 获取进度与结果',
      tags: ['Execute'],
      summary: '异步执行',
      body: executeSyncBodySchema,
      response: {
        202: executeAsyncResponse202,
        400: errorResponse400,
        500: errorResponse500,
      },
    },
  }, async (request, reply) => {
    const parsed = executeAsyncSchema.safeParse(request.body);
    if (!parsed.success) {
      log.warn({ errors: parsed.error.format() }, '异步执行请求参数校验失败');
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      });
    }

    try {
      const response = await orchestrator.executeAsync(parsed.data);
      log.info({ id: parsed.data.id, executionId: response.executionId }, '异步执行已提交');
      return reply.code(202).send(response);
    } catch (err) {
      if (err instanceof AppError) {
        log.error({ id: parsed.data.id, code: err.code }, '异步执行业务异常');
        return reply.code(err.statusCode as 400 | 500 | 202).send({
          error: err.code,
          message: err.message,
        });
      }
      log.error({ id: parsed.data.id, err }, '异步执行未知异常');
      return reply.code(500).send({
        error: 'EXECUTION_ERROR',
        message: (err as Error).message || '执行失败',
      });
    }
  });
}
