import type { IQueue } from './interface.js';
import { MemoryQueue } from './memory-queue.js';
import { RedisQueue } from './redis-queue.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

let queue: IQueue;

export function getQueue(): IQueue {
  if (!queue) {
    const type = getConfig().QUEUE_TYPE;
    if (type === 'redis') {
      queue = new RedisQueue();
      logger.info('使用 Redis 队列');
    } else {
      queue = new MemoryQueue();
      logger.info('使用内存队列');
    }
  }
  return queue;
}
