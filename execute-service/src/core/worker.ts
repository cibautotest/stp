import type { QueueTask } from '../queue/interface.js';
import type { ProgressBus } from '../progress/bus.js';
import type { CancelManager } from './cancel-manager.js';
import type { ExecutionStore } from '../store/execution-store.js';
import type { ReportManager } from '../reports/manager.js';
import { YamlRunner } from './yaml-runner.js';
import { CodeRunner } from './code-runner.js';
import { CodeRecorder } from '../recorder/code-recorder.js';
import { releaseCollector } from '../recorder/dump-collector.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { ApiExchangeProducer } from '../observability/kafka.js';

export class Worker {
  private runner = new YamlRunner();
  private codeRunner = new CodeRunner();
  private codeRecorder = new CodeRecorder();

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
      script,
      screenshotMode,
      trafficTaggingEnabled,
      kafkaConfig,
      loginMethod,
      targetUrl,
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
      const effectiveMode = executionMode ?? 'NLP';
      const result = await this.withTimeout(
        effectiveMode === 'CODE'
          ? this.codeRunner.run(executionId, caseId, name, script || '', isHeadless, this.progressBus, this.cancelManager, cacheContent, reportFileName, executionProducer, trafficTaggingEnabled, loginMethod, targetUrl, screenshotMode)
          : effectiveMode === 'YAML'
            ? this.runner.run(executionId, caseId, yamlScript, isHeadless, this.progressBus, this.cancelManager, cacheContent, reportFileName, executionProducer, trafficTaggingEnabled, loginMethod)
            : this.runner.runNlp(executionId, caseId, nlp, isHeadless, this.progressBus, this.cancelManager, cacheContent, reportFileName, executionProducer, trafficTaggingEnabled, loginMethod, targetUrl),
        timeout,
      );
      await executionProducer?.stop();
      executionProducer = undefined;

      const duration = Date.now() - startTime;
      const reportUrl = await this.uploadReportIfPresent(executionId, reportFileName);
      await this.uploadCacheIfPresent(caseId);

      // 录制：NLP/YAML 执行成功后生成 Playwright 重放脚本并上传平台（关联用例）
      if (result.status === 'completed' && (effectiveMode === 'NLP' || effectiveMode === 'YAML')) {
        await this.recordAndUploadScript(executionId, caseId, name, effectiveMode, nlp, yamlScript, targetUrl);
      }

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
      releaseCollector(executionId);
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

  /**
   * 录制并上传 Playwright 重放脚本：
   * CodeRecorder 从 locate/plan 缓存 + dump 收集器翻译生成 TS 脚本，
   * 经平台内部接口 PUT /internal/scripts/{caseId} 回写并关联用例（失败不影响执行结果）。
   */
  private async recordAndUploadScript(
    executionId: string,
    caseId: string,
    caseName: string,
    mode: 'NLP' | 'YAML',
    nlp: string,
    yamlScript: string,
    targetUrl?: string,
  ): Promise<void> {
    try {
      const script = await this.codeRecorder.generateScript({
        executionId, caseId, caseName, mode, nlp, yamlScript, targetUrl,
      });
      if (!script) return;
      const config = getConfig();
      const url = `${config.PLATFORM_REPORT_UPLOAD_URL.replace(/\/internal\/reports$/, '/internal/scripts')}/${encodeURIComponent(caseId)}?executionId=${encodeURIComponent(executionId)}`;
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'x-report-upload-token': config.REPORT_UPLOAD_TOKEN,
        },
        body: script,
      });
      if (!response.ok) throw new Error(`script upload HTTP ${response.status}`);
      logger.info({ caseId, executionId, bytes: script.length }, '录制脚本已上传平台');
    } catch (err) {
      logger.warn({ caseId, executionId, err }, 'recorded script upload failed (ignored)');
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
