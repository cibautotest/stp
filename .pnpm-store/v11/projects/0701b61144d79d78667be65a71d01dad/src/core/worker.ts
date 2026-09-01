import type { QueueTask } from '../queue/interface.js';
import type { ProgressBus } from '../progress/bus.js';
import type { CancelManager } from './cancel-manager.js';
import type { ExecutionStore } from '../store/execution-store.js';
import type { ReportManager } from '../reports/manager.js';
import { YamlRunner } from './yaml-runner.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { ApiExchangeProducer } from '../observability/kafka.js';

export class Worker {
  private runner = new YamlRunner();

  constructor(
    private progressBus: ProgressBus,
    private cancelManager: CancelManager,
    private store: ExecutionStore,
    private reportManager: ReportManager,
  ) {}

  async execute(task: QueueTask): Promise<void> {
    const {
      executionId,
      caseId,
      name,
      nlp,
      yamlScript,
      timeout,
      headless,
      cacheContent,
      reportFileName,
      executionMode,
      trafficTaggingEnabled,
      kafkaConfig,
    } = task;

    const isHeadless = headless ?? getConfig().BROWSER_HEADLESS;
    logger.info({ executionId, name }, 'Worker started');

    const record = this.store.get(executionId);
    if (!record) {
      logger.error({ executionId }, 'Execution record not found');
      return;
    }

    record.status = 'running';
    record.startedAt = new Date().toISOString();
    this.store.save(record);

    const startTime = Date.now();
    let executionProducer: ApiExchangeProducer | undefined;

    try {
      executionProducer = await ApiExchangeProducer.create(this.kafkaConfigForExecution(kafkaConfig, executionId));
      const result = await this.withTimeout(
        executionMode === 'YAML'
          ? this.runner.run(executionId, caseId, yamlScript, isHeadless, this.progressBus, this.cancelManager, cacheContent, reportFileName, executionProducer, trafficTaggingEnabled)
          : this.runner.runNlp(executionId, caseId, nlp, isHeadless, this.progressBus, this.cancelManager, cacheContent, reportFileName, executionProducer, trafficTaggingEnabled),
        timeout,
      );
      await executionProducer?.stop();
      executionProducer = undefined;

      const duration = Date.now() - startTime;
      const reportUrl = await this.uploadReportIfPresent(executionId, reportFileName);
      await this.uploadCacheIfPresent(caseId);
      result.reportUrl = reportUrl;
      await this.notifyPlatform(task, result.status === 'completed' ? 'SUCCESS' : 'FAILED', reportUrl, duration, result);

      const updated = this.store.get(executionId)!;
      updated.status = result.status as any;
      updated.completedAt = new Date().toISOString();
      updated.duration = duration;
      updated.reportUrl = reportUrl;
      updated.result = result;
      this.store.save(updated);

      if (result.status === 'completed') {
        this.progressBus.emit(executionId, {
          type: 'completed',
          reportUrl: reportUrl ?? '',
          duration,
          result,
        });
      } else {
        this.progressBus.emit(executionId, {
          type: 'failed',
          error: 'Execution did not pass all steps',
          reportUrl: reportUrl ?? undefined,
        });
      }
    } catch (err) {
      await executionProducer?.stop();
      const duration = Date.now() - startTime;
      const message = (err as Error).message;
      const reportUrl = await this.uploadReportIfPresent(executionId, reportFileName);
      await this.uploadCacheIfPresent(caseId);
      const cancelled = this.cancelManager.isCancelled(executionId);
      await this.notifyPlatform(task, cancelled ? 'CANCELLED' : 'FAILED', reportUrl, duration, null, message);

      const updated = this.store.get(executionId)!;
      updated.completedAt = new Date().toISOString();
      updated.duration = duration;
      updated.error = message;
      updated.reportUrl = reportUrl;

      if (cancelled) {
        updated.status = 'cancelled';
        this.store.save(updated);
        this.progressBus.emit(executionId, {
          type: 'cancelled',
          message: 'Execution cancelled by user',
        });
      } else {
        updated.status = 'failed';
        this.store.save(updated);
        this.progressBus.emit(executionId, {
          type: 'failed',
          error: message,
          reportUrl: reportUrl ?? undefined,
        });
      }
    }
  }

  private async uploadCacheIfPresent(caseId: string): Promise<void> {
    const file = `${process.cwd()}/midscene_run/cache/${caseId}.cache.yaml`;
    try {
      const fs = await import('node:fs/promises');
      const content = await fs.readFile(file);
      const config = getConfig();
      const url = `${config.PLATFORM_REPORT_UPLOAD_URL.replace(/\/internal\/reports$/, '/internal/caches')}/${encodeURIComponent(caseId)}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-report-upload-token': config.REPORT_UPLOAD_TOKEN,
        },
        body: content,
      });
      if (!response.ok) throw new Error(`cache upload HTTP ${response.status}`);
    } catch (err) {
      logger.warn({ caseId, err }, 'cache upload failed');
    }
  }

  private kafkaConfigForExecution(kafkaConfig: QueueTask['kafkaConfig'], executionId: string): QueueTask['kafkaConfig'] {
    if (!kafkaConfig) return undefined;
    const baseClientId = kafkaConfig.clientId || getConfig().KAFKA_CLIENT_ID;
    return {
      ...kafkaConfig,
      clientId: this.withExecutionClientId(baseClientId, executionId),
    };
  }

  private withExecutionClientId(baseClientId: string, executionId: string): string {
    const suffix = executionId.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 64);
    const prefix = (baseClientId || 'smart-testing-execute').replace(/[^a-zA-Z0-9._-]/g, '-');
    const maxPrefixLength = Math.max(1, 240 - suffix.length);
    return `${prefix.slice(0, maxPrefixLength)}-${suffix}`;
  }

  private async uploadReportIfPresent(executionId: string, reportFileName: string): Promise<string | null> {
    if (!this.reportManager.reportExists(reportFileName)) return null;
    try {
      return await this.reportManager.uploadReport(executionId, reportFileName);
    } catch (err) {
      logger.error({ executionId, err }, 'Report upload to platform failed');
      return null;
    }
  }

  private async notifyPlatform(
    task: QueueTask,
    status: 'SUCCESS' | 'FAILED' | 'CANCELLED',
    reportUrl: string | null,
    duration: number,
    result: unknown,
    error?: string,
  ): Promise<void> {
    const callbackUrl = getConfig().PLATFORM_CALLBACK_URL.trim();
    if (!callbackUrl) return;

    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          caseId: task.caseId,
          executionId: task.executionId,
          status,
          error,
          reportUrl,
          duration,
          result,
          logs: [],
        }),
      });
      if (!response.ok) {
        throw new Error(`callback HTTP ${response.status}`);
      }
    } catch (err) {
      logger.error({ executionId: task.executionId, err }, 'Execution result callback to platform failed');
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    if (timeoutMs <= 0) return promise;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out (${timeoutMs}ms)`));
      }, timeoutMs);

      promise.then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); },
      );
    });
  }
}
