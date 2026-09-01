import type { IQueue, QueueTask } from './interface.js';
import { QueueFullError } from '../utils/errors.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Redis 队列实现（预留）
 *
 * 使用 Redis List 做任务队列：
 *   - LPUSH 入队
 *   - BRPOP 阻塞出队（消费者）
 *
 * 前置条件：QUEUE_TYPE=redis + REDIS_URL 配置
 */
export class RedisQueue implements IQueue {
  private redis: any; // ioredis 实例
  private connected = false;

  constructor() {
    const Redis = require('ioredis').default;
    this.redis = new Redis(getConfig().REDIS_URL);
    this.redis.on('connect', () => {
      this.connected = true;
      logger.info('Redis 队列已连接');
    });
    this.redis.on('error', (err: Error) => {
      logger.error({ err }, 'Redis 队列连接错误');
    });
  }

  async enqueue(task: QueueTask): Promise<void> {
    const maxSize = getConfig().QUEUE_MAX_SIZE;
    const len = await this.redis.llen('execute:queue');
    if (len >= maxSize) {
      throw new QueueFullError();
    }

    // 存储任务详情 + 入队
    await this.redis.set(`execute:task:${task.executionId}`, JSON.stringify(task));
    await this.redis.lpush('execute:queue', task.executionId);
    logger.info({ executionId: task.executionId }, '任务入队 (Redis)');
  }

  async dequeue(): Promise<QueueTask | null> {
    if (!this.connected) return null;

    const result = await this.redis.brpop('execute:queue', 1);
    if (!result) return null;

    const [, executionId] = result;
    const raw = await this.redis.get(`execute:task:${executionId}`);
    if (!raw) return null;

    await this.redis.del(`execute:task:${executionId}`);
    return JSON.parse(raw) as QueueTask;
  }

  async remove(executionId: string): Promise<boolean> {
    const removed = await this.redis.lrem('execute:queue', 0, executionId);
    if (removed > 0) {
      await this.redis.del(`execute:task:${executionId}`);
      logger.info({ executionId }, '任务从队列中移除 (Redis)');
      return true;
    }
    return false;
  }

  async getPosition(executionId: string): Promise<number> {
    const list = await this.redis.lrange('execute:queue', 0, -1);
    const idx = list.indexOf(executionId);
    return idx === -1 ? -1 : idx + 1;
  }

  async getQueueLength(): Promise<number> {
    return this.redis.llen('execute:queue');
  }

  /**
   * Redis 模式消费者：轮询消费
   */
  onTask(handler: (task: QueueTask) => Promise<void>): void {
    const poll = async () => {
      const task = await this.dequeue();
      if (task) {
        await handler(task);
      }
      setTimeout(poll, 100);
    };
    poll();
  }
}
