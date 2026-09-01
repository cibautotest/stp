import type { FastifyInstance } from 'fastify';
import type { Orchestrator } from '../../core/orchestrator.js';
import { executeSyncSchema } from '../schemas.js';
import { AppError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';
import {
  executeSyncBodySchema,
  executeSyncResponse200,
  errorResponse400,
  errorResponse500,
} from '../openapi-schemas.js';

const log = createLogger('Route:Sync');

export async function syncRoutes(server: FastifyInstance, orchestrator: Orchestrator): Promise<void> {
  server.post('/execute/sync', {
    schema: {
      description: '同步执行测试用例 — 阻塞等待结果后返回完整的执行报告',
      tags: ['Execute'],
      summary: '同步执行',
      body: executeSyncBodySchema,
      response: {
        200: executeSyncResponse200,
        400: errorResponse400,
        500: errorResponse500,
      },
    },
  }, async (request, reply) => {
    const parsed = executeSyncSchema.safeParse(request.body);
    if (!parsed.success) {
      log.warn({ errors: parsed.error.format() }, '同步执行请求参数校验失败');
      return reply.code(400).send({
        error: 'VALIDATION_ERROR',
        details: parsed.error.format(),
      });
    }

    log.info({ id: parsed.data.id, name: parsed.data.name }, '同步执行请求开始');
    try {
      const result = await orchestrator.executeSync(parsed.data);
      log.info({ id: parsed.data.id, executionId: result.executionId }, '同步执行完成');
      return reply.send(result);
    } catch (err) {
      if (err instanceof AppError) {
        log.error({ id: parsed.data.id, code: err.code }, '同步执行业务异常');
        return reply.code(err.statusCode as 400 | 500 | 200).send({
          error: err.code,
          message: err.message,
        });
      }
      log.error({ id: parsed.data.id, err }, '同步执行未知异常');
      return reply.code(500).send({
        error: 'EXECUTION_ERROR',
        message: (err as Error).message || '执行失败',
      });
    }
  });
}
