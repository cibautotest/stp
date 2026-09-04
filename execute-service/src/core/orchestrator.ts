import { randomUUID } from 'node:crypto';
import type { TestCaseInput } from '../models/test-case.js';
import type { ExecutionRecord, ExecutionResult } from '../models/execution.js';
import type { ProgressEvent } from '../models/progress.js';
import type { IQueue } from '../queue/interface.js';
import type { ProgressBus } from '../progress/bus.js';
import type { CancelManager } from './cancel-manager.js';
import type { ExecutionStore } from '../store/execution-store.js';
import type { ReportManager } from '../reports/manager.js';
import { WorkerPool } from './worker-pool.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { ValidationError } from '../utils/errors.js';

export class Orchestrator {
  private workerPool: WorkerPool;

  constructor(
    private queue: IQueue,
    private progressBus: ProgressBus,
    private cancelManager: CancelManager,
    private store: ExecutionStore,
    private reportManager: ReportManager,
  ) {
    this.workerPool = new WorkerPool(queue, progressBus, cancelManager, store, reportManager);
    this.workerPool.start();
  }

  // ── 同步执行 ──

  async executeSync(input: TestCaseInput): Promise<ExecutionResult> {
    const executionId = randomUUID();
    const config = getConfig();

    logger.info({ executionId, name: input.name }, '同步执行请求');

    // 1. 校验 YAML（基础校验）

    // 2. 创建执行记录
    const record = this.createRecord(executionId, input);
    this.store.save(record);

    // 3. 启动进度监听，等待最终结果
    const resultPromise = this.waitForResult(executionId);

    // 4. 入队执行（同步等待结果）
    await this.queue.enqueue({
      executionId,
      caseId: input.id,
      name: input.name,
      yamlScript: input.yamlScript ?? '',
      nlp: input.nlp,
      timeout: input.timeout ?? config.SYNC_TIMEOUT_MS,
      headless: input.headless ?? config.BROWSER_HEADLESS,
      cacheContent: input.cacheContent,
      reportFileName: this.reportFileName(input.name),
      executionMode: input.executionMode ?? 'NLP',
      trafficTaggingEnabled: input.trafficTaggingEnabled ?? config.OBSERVABILITY_ENABLED,
      kafkaConfig: input.kafkaConfig,
      loginMethod: input.loginMethod,
      targetUrl: input.targetUrl,
    });

    const position = await this.queue.getPosition(executionId);
    this.progressBus.emit(executionId, { type: 'queued', position });

    // 5. 阻塞等待执行结果
    try {
      return await resultPromise;
    } catch (err) {
      throw err;
    }
  }

  // ── 异步执行 ──

  async executeAsync(input: TestCaseInput): Promise<{ executionId: string; status: string }> {
    const executionId = randomUUID();
    const config = getConfig();

    logger.info({ executionId, name: input.name }, '异步执行请求');

    // 1. 校验 YAML（基础校验）

    // 2. 创建执行记录
    const record = this.createRecord(executionId, input);
    record.status = 'queued';
    this.store.save(record);

    // 3. 入队
    await this.queue.enqueue({
      executionId,
      caseId: input.id,
      name: input.name,
      yamlScript: input.yamlScript ?? '',
      nlp: input.nlp,
      timeout: input.timeout ?? config.EXECUTION_TIMEOUT_MS,
      headless: input.headless ?? config.BROWSER_HEADLESS,
      cacheContent: input.cacheContent,
      reportFileName: this.reportFileName(input.name),
      executionMode: input.executionMode ?? 'NLP',
      trafficTaggingEnabled: input.trafficTaggingEnabled ?? config.OBSERVABILITY_ENABLED,
      kafkaConfig: input.kafkaConfig,
      loginMethod: input.loginMethod,
      targetUrl: input.targetUrl,
    });

    // 4. 推送 queued
    const position = await this.queue.getPosition(executionId);
    record.queuePosition = position;
    this.store.save(record);

    this.progressBus.emit(executionId, {
      type: 'queued',
      position,
    });

    return { executionId, status: 'queued' };
  }

  // ── 状态查询 ──

  async getStatus(executionId: string): Promise<Partial<ExecutionRecord>> {
    const record = this.store.get(executionId);
    if (!record) {
      throw new ValidationError(`执行记录不存在: ${executionId}`);
    }

    const position = await this.queue.getPosition(executionId);
    if (position >= 0) {
      record.queuePosition = position;
    }

    return {
      executionId: record.executionId,
      status: record.status,
      progress: record.progress,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      duration: record.duration,
      reportUrl: record.reportUrl,
      error: record.error,
      queuePosition: record.queuePosition,
    };
  }

  // ── 取消执行 ──

  async cancel(executionId: string): Promise<{ success: boolean; message: string }> {
    const record = this.store.get(executionId);
    if (!record) {
      return { success: false, message: '执行记录不存在' };
    }

    if (record.status === 'completed' || record.status === 'failed') {
      return { success: false, message: '执行已结束，无法取消' };
    }

    const dequeued = await this.queue.remove(executionId);
    if (dequeued) {
      record.status = 'cancelled';
      this.store.save(record);
      this.progressBus.emit(executionId, {
        type: 'cancelled',
        message: '用户取消执行',
      });
      return { success: true, message: '已取消队列中的任务' };
    }

    const cancelled = this.cancelManager.cancel(executionId);
    if (cancelled) {
      return { success: true, message: '已发送取消信号，执行将尽快停止' };
    }

    return { success: false, message: '无法取消，任务可能已结束' };
  }

  // ── 内部：等待同步执行结果 ──

  private waitForResult(executionId: string): Promise<ExecutionResult> {
    return new Promise((resolve, reject) => {
      const handler = (event: ProgressEvent) => {
        if (event.type === 'completed') {
          const record = this.store.get(executionId);
          if (record?.result) {
            resolve(record.result);
          } else {
            resolve(event.result);
          }
        } else if (event.type === 'failed') {
          // 失败时也从 store 获取完整结果（包含 reportUrl），而非直接 reject
          const record = this.store.get(executionId);
          if (record?.result) {
            resolve(record.result);
          } else {
            // 兜底：构建一个带 reportUrl 的失败结果
            const reportUrl = null;
            resolve({
              executionId,
              status: 'failed',
              tasks: [],
              reportUrl,
            });
          }
        } else if (event.type === 'cancelled') {
          reject(new Error(event.message || '执行已取消'));
        }
      };
      this.progressBus.subscribe(executionId, handler);
    });
  }

  // ── 工具 ──

  private createRecord(
    executionId: string,
    input: TestCaseInput,
  ): ExecutionRecord {
    return {
      executionId,
      input: { id: input.id, name: input.name },
      yamlScript: input.yamlScript ?? '',
      status: 'pending',
      progress: 0,
      startedAt: null,
      completedAt: null,
      duration: null,
      reportUrl: null,
      error: null,
      result: null,
      queuePosition: -1,
    };
  }

  private reportFileName(name: string): string {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const safeName = (name || '')
      .replace(/[\\/:*?"<>|\r\n\t]+/g, '_')
      .trim()
      .slice(0, 80) || 'test-case';
    return `${safeName}-${stamp}`;
  }
}
