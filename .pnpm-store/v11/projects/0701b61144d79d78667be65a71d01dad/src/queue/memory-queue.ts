import { EventEmitter } from 'node:events';
import type { IQueue, QueueTask } from './interface.js';
import { QueueFullError } from '../utils/errors.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export class MemoryQueue implements IQueue {
  private tasks: QueueTask[] = [];
  private emitter = new EventEmitter();
  private processingIds = new Set<string>();

  enqueue(task: QueueTask): Promise<void> {
    const maxSize = getConfig().QUEUE_MAX_SIZE;
    if (this.tasks.length >= maxSize) {
      throw new QueueFullError();
    }

    this.tasks.push(task);
    this.emitter.emit('task-ready');

    logger.info({ executionId: task.executionId }, '任务入队');
    return Promise.resolve();
  }

  async dequeue(): Promise<QueueTask | null> {
    const task = this.tasks.shift() ?? null;
    if (task) {
      this.processingIds.add(task.executionId);
    }
    return task;
  }

  async remove(executionId: string): Promise<boolean> {
    const idx = this.tasks.findIndex(t => t.executionId === executionId);
    if (idx !== -1) {
      this.tasks.splice(idx, 1);
      logger.info({ executionId }, '任务从队列中移除');
      return true;
    }
    if (this.processingIds.has(executionId)) {
      logger.warn({ executionId }, '任务正在执行中，无法从队列移除');
      return false;
    }
    return false;
  }

  async getPosition(executionId: string): Promise<number> {
    const idx = this.tasks.findIndex(t => t.executionId === executionId);
    if (idx !== -1) return idx + 1;
    if (this.processingIds.has(executionId)) return 0;
    return -1;
  }

  async getQueueLength(): Promise<number> {
    return this.tasks.length;
  }

  onTask(handler: (task: QueueTask) => Promise<void>): void {
    this.emitter.on('task-ready', async () => {
      const task = await this.dequeue();
      if (task) {
        await handler(task);
        this.processingIds.delete(task.executionId);
      }
    });
  }
}
