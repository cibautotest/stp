import { EventEmitter } from 'node:events';
import type { ProgressEvent } from '../models/progress.js';
import { logger } from '../utils/logger.js';

/** Omit that properly distributes over union types */
type DistributiveOmit<T, K extends string> = T extends any ? Omit<T, K> : never;

export class ProgressBus {
  private emitter = new EventEmitter();

  emit(executionId: string, event: DistributiveOmit<ProgressEvent, 'executionId'>): void {
    const fullEvent = { ...event, executionId } as ProgressEvent;
    this.emitter.emit(executionId, fullEvent);
    this.emitter.emit('*', fullEvent);
    logger.debug({ event: fullEvent.type, executionId }, '进度事件');
  }

  subscribe(executionId: string, handler: (event: ProgressEvent) => void): void {
    this.emitter.on(executionId, handler);
  }

  unsubscribe(executionId: string, handler: (event: ProgressEvent) => void): void {
    this.emitter.off(executionId, handler);
  }

  once(executionId: string, handler: (event: ProgressEvent) => void): void {
    this.emitter.once(executionId, handler);
  }

  removeAllListeners(executionId: string): void {
    this.emitter.removeAllListeners(executionId);
  }
}

// 全局单例
export const progressBus = new ProgressBus();
