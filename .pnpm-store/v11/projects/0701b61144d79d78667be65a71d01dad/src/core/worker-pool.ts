import type { IQueue, QueueTask } from '../queue/interface.js';
import type { ProgressBus } from '../progress/bus.js';
import type { CancelManager } from './cancel-manager.js';
import type { ExecutionStore } from '../store/execution-store.js';
import type { ReportManager } from '../reports/manager.js';
import { Worker } from './worker.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export class WorkerPool {
  private workers: Worker[] = [];
  private busy = 0;
  private readonly maxConcurrency: number;
  private waitQueue: Array<() => void> = [];

  constructor(
    private queue: IQueue,
    private progressBus: ProgressBus,
    private cancelManager: CancelManager,
    private store: ExecutionStore,
    private reportManager: ReportManager,
  ) {
    this.maxConcurrency = getConfig().WORKER_CONCURRENCY;
    logger.info({ maxConcurrency: this.maxConcurrency }, 'WorkerPool 初始化');
  }

  start(): void {
    this.queue.onTask(async (task: QueueTask) => {
      await this.acquireAndRun(task);
    });
    logger.info('WorkerPool 消费者已启动');
  }

  private async acquireAndRun(task: QueueTask): Promise<void> {
    await this.acquire();
    const worker = this.getOrCreateWorker();

    try {
      await worker.execute(task);
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.busy < this.maxConcurrency) {
      this.busy++;
      return Promise.resolve();
    }
    return new Promise(resolve => {
      this.waitQueue.push(() => { this.busy++; resolve(); });
    });
  }

  private release(): void {
    this.busy--;
    const next = this.waitQueue.shift();
    if (next) next();
  }

  private getOrCreateWorker(): Worker {
    if (this.workers.length < this.maxConcurrency) {
      const w = new Worker(this.progressBus, this.cancelManager, this.store, this.reportManager);
      this.workers.push(w);
      return w;
    }
    return this.workers[this.busy % this.workers.length];
  }

  get activeCount(): number { return this.busy; }
  get waitingCount(): number { return this.waitQueue.length; }
}
