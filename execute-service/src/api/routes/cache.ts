import type { FastifyInstance } from 'fastify';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('Route:Cache');

// caseId 合法性（防路径穿越）：仅字母数字、下划线、连字符
const SAFE_ID = /^[\w-]{1,128}$/;

/**
 * 用例缓存查询：返回执行引擎磁盘上的 Midscene 缓存文件（真相源）。
 * 平台侧在 DB cache_content 为空时回源此接口并回填。
 */
export async function cacheRoutes(server: FastifyInstance): Promise<void> {
  server.get('/cache/:caseId', {
    schema: {
      description: '查询指定用例的 Midscene 磁盘缓存内容（YAML 文本）',
      tags: ['Cache'],
      summary: '获取用例缓存',
      params: {
        type: 'object',
        properties: { caseId: { type: 'string', description: '用例 ID' } },
        required: ['caseId'],
      },
    },
  }, async (request, reply) => {
    const { caseId } = request.params as { caseId: string };
    if (!SAFE_ID.test(caseId)) {
      return reply.code(400).send({ error: 'Invalid case ID' });
    }
    const file = path.resolve('midscene_run/cache', `${caseId}.cache.yaml`);
    try {
      const content = await readFile(file, 'utf8');
      if (!content.trim()) return reply.code(404).send({ error: 'Cache not found' });
      return reply.type('text/plain; charset=utf-8').send(content);
    } catch {
      log.debug({ caseId }, '缓存文件不存在');
      return reply.code(404).send({ error: 'Cache not found' });
    }
  });
}
