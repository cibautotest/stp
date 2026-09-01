import yaml from 'js-yaml';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import 'dotenv/config';
import { PlaywrightAgent } from '@midscene/web/playwright';
import type { YamlDoc } from '../models/test-case.js';
import type { ExecutionResult } from '../models/execution.js';
import type { ProgressBus } from '../progress/bus.js';
import type { CancelManager } from './cancel-manager.js';
import { logger } from '../utils/logger.js';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ApiExchangeProducer } from '../observability/kafka.js';
import { NetworkObserver } from '../observability/network-observer.js';
import { getConfig } from '../config.js';

/**
 * YAML 脚本执行器
 *
 * 核心逻辑：
 *   解析原始 YAML → 提取 web/agent 配置 → 启动浏览器 → 初始化 Agent → agent.runYaml()
 *
 * 注意：报告 URL 由 Worker 层通过 ReportManager 生成，Runner 只负责执行。
 */
export class YamlRunner {
  async runNlp(
    executionId: string,
    caseId: string,
    nlp: string,
    headless: boolean,
    progressBus: ProgressBus,
    cancelManager: CancelManager,
    cacheContent?: string,
    reportFileName?: string, producer?: ApiExchangeProducer, trafficTaggingEnabled = false,
  ): Promise<ExecutionResult> {
    const cacheDir = path.resolve('midscene_run/cache');
    await fs.mkdir(cacheDir, { recursive: true });
    if (cacheContent) await fs.writeFile(path.join(cacheDir, `${caseId}.cache.yaml`), cacheContent, 'utf8');
    const browser = await chromium.launch({ headless, channel: 'chrome', args: ['--ignore-certificate-errors'] });
    const context = await browser.newContext({ ignoreHTTPSErrors: true }); const observer = this.createNetworkObserver(executionId, caseId, producer, trafficTaggingEnabled);
    await observer?.install(context); const page = await context.newPage();
    const agent = new PlaywrightAgent(page, { generateReport: true, reportFileName: reportFileName || executionId, cache: { id: caseId } });
    try {
      if (cancelManager.isCancelled(executionId)) return this.cancelledResult(executionId);
      progressBus.emit(executionId, { type: 'step_progress', subTask: 'Executing natural-language test instruction with Midscene...' });
      await agent.aiAct(nlp);
      return { executionId, status: 'completed', tasks: [{ name: 'NLP test', status: 'passed', steps: [] }], reportUrl: null };
    } finally {
      await observer?.flush();
      await agent.destroy().catch(() => {});
      await browser.close().catch(() => {});
      cancelManager.remove(executionId);
    }
  }

  async run(
    executionId: string,
    caseId: string,
    yamlScript: string,
    headless: boolean,
    progressBus: ProgressBus,
    cancelManager: CancelManager,
    cacheContent?: string,
    reportFileName?: string, producer?: ApiExchangeProducer, trafficTaggingEnabled = false,
  ): Promise<ExecutionResult> {
    const cacheDir = path.resolve('midscene_run/cache');
    await fs.mkdir(cacheDir, { recursive: true });
    const cachePath = path.join(cacheDir, `${caseId}.cache.yaml`);
    if (cacheContent) await fs.writeFile(cachePath, cacheContent, 'utf8');
    // 1. 解析 YAML
    const rawDoc = yaml.load(yamlScript) as YamlDoc;

    // 2. 启动浏览器（优先使用系统 Chrome，避免 Playwright 浏览器引擎缺失问题）
    const browser = await chromium.launch({ headless, channel: 'chrome', args: ['--ignore-certificate-errors'] });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: {
        width: rawDoc.web?.viewportWidth ?? 1280,
        height: rawDoc.web?.viewportHeight ?? 960,
      },
      userAgent: rawDoc.web?.userAgent,
    });
    const observer = this.createNetworkObserver(executionId, caseId, producer, trafficTaggingEnabled);
    await observer?.install(context);

    // 加载 cookie
    if (rawDoc.web?.cookie) {
      await this.loadCookies(rawDoc.web.cookie, context);
    }

    const page = await context.newPage();

    // 3. 从 YAML agent 段提取 Agent 初始化配置
    const agentConfig = rawDoc.agent ?? {};
    const agentOpts: any = {
      testId: agentConfig.testId,
      groupName: agentConfig.groupName,
      groupDescription: agentConfig.groupDescription,
      generateReport: agentConfig.generateReport ?? true,
      autoPrintReportMsg: agentConfig.autoPrintReportMsg,
      reportFileName: reportFileName || agentConfig.reportFileName || executionId,
      replanningCycleLimit: agentConfig.replanningCycleLimit,
      aiActContext: agentConfig.aiActContext,
      cache: {
        id: caseId,
      },
    };

    const agent = new PlaywrightAgent(page, agentOpts);

    try {
      // 4. 检查取消
      if (cancelManager.isCancelled(executionId)) {
        return this.cancelledResult(executionId);
      }

      // 5. 导航到目标 URL
      progressBus.emit(executionId, {
        type: 'step_progress',
        subTask: `正在打开 ${rawDoc.web?.url}`,
      });

      await page.goto(rawDoc.web!.url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // 6. 等待网络空闲（如果 YAML 中配置了）
      if (rawDoc.web?.waitForNetworkIdle) {
        try {
          await page.waitForLoadState('networkidle', {
            timeout: rawDoc.web.waitForNetworkIdle.timeout || 10000,
          });
        } catch {
          if (!rawDoc.web.waitForNetworkIdle.continueOnNetworkIdleError) {
            throw new Error('网络空闲等待失败');
          }
        }
      }

      // 7. 提取 tasks 段传给 runYaml（agent.runYaml 只解析 tasks 段）
      const tasksOnly = { tasks: rawDoc.tasks };
      const yamlTasks = yaml.dump(tasksOnly);

      logger.info(
        { executionId, tasks: rawDoc.tasks.length, url: rawDoc.web?.url },
        '开始执行 runYaml',
      );

      progressBus.emit(executionId, {
        type: 'step_progress',
        subTask: '正在执行 YAML 任务流...',
      });

      // 8. 执行 runYaml
      const runResult = await agent.runYaml(yamlTasks);

      logger.info({ executionId, runResult }, 'runYaml 执行完成');

      // 9. 收集结果（reportUrl 由 Worker 层填充）
      const tasks = this.buildTaskResults(runResult, rawDoc);

      return {
        executionId,
        status: 'completed',
        tasks,
        reportUrl: null,
      };
    } finally {
      await observer?.flush();
      await agent.destroy().catch(() => {});
      await browser.close().catch(() => {});
      cancelManager.remove(executionId);
    }
  }

  /**
   * 从 runYaml 返回结果构建 TaskResult[]
   */
  private buildTaskResults(runResult: any, rawDoc: YamlDoc): Array<{
    name: string;
    status: 'passed' | 'failed';
    steps: Array<{
      index: number;
      type: string;
      status: 'passed' | 'failed';
      duration: number;
      error?: string;
    }>;
  }> {
    if (!runResult) {
      return rawDoc.tasks.map((task, i) => ({
        name: task.name || `任务${i + 1}`,
        status: 'passed' as const,
        steps: [],
      }));
    }

    if (Array.isArray(runResult.result)) {
      return runResult.result.map((taskResult: any, i: number) => ({
        name: taskResult.name || rawDoc.tasks[i]?.name || `任务${i + 1}`,
        status: (taskResult.status || 'passed') as 'passed' | 'failed',
        steps: Array.isArray(taskResult.steps)
          ? taskResult.steps.map((step: any, si: number) => ({
              index: si + 1,
              type: step.type || 'unknown',
              status: (step.status || 'passed') as 'passed' | 'failed',
              duration: step.duration || 0,
              error: step.error,
            }))
          : [],
      }));
    }

    return rawDoc.tasks.map((task, i) => ({
      name: task.name || `任务${i + 1}`,
      status: 'passed' as const,
      steps: [],
    }));
  }

  // ── 工具方法 ──

  private async loadCookies(
    cookiePath: string,
    context: BrowserContext,
  ): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const raw = await fs.readFile(cookiePath, 'utf-8');
      const cookies = JSON.parse(raw);
      await context.addCookies(cookies);
      logger.info({ cookiePath }, '已加载 cookie');
    } catch (err) {
      logger.warn({ cookiePath, err }, '加载 cookie 失败，忽略');
    }
  }

  private cancelledResult(executionId: string): ExecutionResult {
    return {
      executionId,
      status: 'failed',
      tasks: [],
      reportUrl: null,
    };
  }

  private createNetworkObserver(
    executionId: string,
    caseId: string,
    producer?: ApiExchangeProducer,
    trafficTaggingEnabled = false,
  ): NetworkObserver | undefined {
    return producer || trafficTaggingEnabled || getConfig().OBSERVABILITY_ENABLED
      ? new NetworkObserver(executionId, caseId, producer, trafficTaggingEnabled)
      : undefined;
  }
}
