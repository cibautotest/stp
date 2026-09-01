import type { FastifyInstance } from 'fastify';
import type { ReportManager } from '../../reports/manager.js';
import type { ExecutionStore } from '../../store/execution-store.js';
import { BatchReportMerger } from '../../reports/merge.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('Route:Merge');

export async function mergeRoutes(
  server: FastifyInstance,
  reportManager: ReportManager,
  store: ExecutionStore,
): Promise<void> {
  const merger = new BatchReportMerger(reportManager, store);

  server.post('/execute/merge-reports', {
    schema: {
      description: '合并多个执行报告为统一的 HTML 报告',
      tags: ['Execute'],
      summary: '合并批量执行报告',
      body: {
        type: 'object',
        required: ['executionIds'],
        properties: {
          executionIds: {
            type: 'array',
            items: { type: 'string' },
            description: '要合并的 executionId 列表',
          },
          batchName: {
            type: 'string',
            description: '合并报告文件名（可选）',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            mergedReportPath: { type: ['string', 'null'] },
            mergedReportUrl: { type: ['string', 'null'] },
            error: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            mergedReportPath: { type: ['string', 'null'] },
            mergedReportUrl: { type: ['string', 'null'] },
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      executionIds: string[];
      batchName?: string;
    };

    log.info(
      { count: body.executionIds.length, batchName: body.batchName },
      '收到报告合并请求',
    );

    const result = await merger.mergeReports(body);

    if (!result.success) {
      log.warn({ count: body.executionIds.length, error: result.error }, '报告合并失败');
      return reply.code(400).send(result);
    }

    log.info({ mergedReportPath: result.mergedReportPath }, '报告合并成功');
    return reply.send(result);
  });
}
