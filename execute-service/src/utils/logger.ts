import pino from 'pino';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../config.js';

const LOG_DIR = './logs';

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const config = getConfig();
const isDev = config.LOG_LEVEL === 'debug' || config.LOG_LEVEL === 'trace';

/**
 * 根 logger — 同时输出到控制台和文件
 * - 控制台：彩色友好格式（开发环境）
 * - 文件：JSON 格式，便于日志分析工具消费
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  // 开发环境：彩色格式；生产环境：纯 JSON
  ...(isDev
    ? {
        transport: {
          targets: [
            { target: 'pino/file', options: { destination: 1 } },
            {
              target: 'pino/file',
              options: { destination: path.join(LOG_DIR, 'execute-service.log') },
            },
          ],
        },
      }
    : {
        streams: [
          { stream: process.stdout },
          { stream: fs.createWriteStream(path.join(LOG_DIR, 'execute-service.log'), { flags: 'a' }) },
        ],
      }),
});

/**
 * 创建子 logger（带模块名前缀，便于快速定位来源）
 *
 * @example
 * const log = createLogger('BatchExecution');
 * log.info('batch started'); // {"level":30,"module":"BatchExecution","msg":"batch started",...}
 */
export function createLogger(module: string): pino.Logger {
  return logger.child({ module });
}

/**
 * Fastify 请求日志 hook — 记录所有 HTTP 请求/响应
 * 记录：method、url、statusCode、耗时、请求体大小
 *
 * 跳过 /health 端点（避免刷日志）
 */
export const requestLogger = {
  hook(request: any, reply: any, done: any) {
    const start = Date.now();
    const { method, url } = request;

    reply.raw.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = reply;

      // 跳过健康检查和静态资源
      if (url === '/health' || url.startsWith('/docs') || url.startsWith('/reports/')) {
        return;
      }

      const logObj: Record<string, any> = {
        method,
        url,
        statusCode,
        duration,
      };

      if (request.body && Object.keys(request.body).length > 0) {
        // 截断大请求体，避免日志膨胀
        const bodyStr = JSON.stringify(request.body);
        logObj.body = bodyStr.length > 500 ? bodyStr.slice(0, 500) + '...[truncated]' : request.body;
      }

      if (request.params && Object.keys(request.params).length > 0) {
        logObj.params = request.params;
      }

      if (request.query && Object.keys(request.query).length > 0) {
        logObj.query = request.query;
      }

      // 按状态码分级
      if (statusCode >= 500) {
        logger.error(logObj, `${method} ${url} -> ${statusCode} (${duration}ms)`);
      } else if (statusCode >= 400) {
        logger.warn(logObj, `${method} ${url} -> ${statusCode} (${duration}ms)`);
      } else if (duration > 5000) {
        logger.warn(logObj, `${method} ${url} -> ${statusCode} (${duration}ms) SLOW`);
      } else {
        logger.info(logObj, `${method} ${url} -> ${statusCode} (${duration}ms)`);
      }
    });

    done();
  },
};
