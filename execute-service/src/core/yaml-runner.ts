import yaml from 'js-yaml';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import 'dotenv/config';
import { PlaywrightAgent } from '@midscene/web/playwright';
import type { YamlDoc, LoginMethodPayload } from '../models/test-case.js';
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
    loginMethod?: LoginMethodPayload,
    targetUrl?: string,
  ): Promise<ExecutionResult> {
    const cacheDir = path.resolve('midscene_run/cache');
    await fs.mkdir(cacheDir, { recursive: true });
    if (cacheContent) await fs.writeFile(path.join(cacheDir, `${caseId}.cache.yaml`), cacheContent, 'utf8');
    const browser = await chromium.launch({ headless, channel: 'chrome', args: ['--ignore-certificate-errors'] });
    const context = await browser.newContext({ ignoreHTTPSErrors: true }); const observer = this.createNetworkObserver(executionId, caseId, producer, trafficTaggingEnabled);
    await observer?.install(context); const page = await context.newPage();

    // 登录阶段：非免登录方式时先执行登录（独立缓存 ID，浏览器不中断）
    if (loginMethod && loginMethod.type && loginMethod.type !== 'none') {
      progressBus.emit(executionId, { type: 'step_progress', subTask: '正在执行登录阶段...' });
      await this.runLoginStage(page, executionId, loginMethod);
    }

    // NLP 模式目标页面导航：NLP 本身不含网址时，先打开目标页（登录后跳转到业务地址；
    // 若目标地址即登录页则跳过，避免跳回登录页）
    if (targetUrl && !(loginMethod?.loginUrl && this.urlsEqual(targetUrl, loginMethod.loginUrl))) {
      progressBus.emit(executionId, { type: 'step_progress', subTask: `正在打开 ${targetUrl}` });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

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
    loginMethod?: LoginMethodPayload,
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

    // 登录阶段：非免登录方式时先执行登录（独立缓存 ID，浏览器不中断）
    if (loginMethod && loginMethod.type && loginMethod.type !== 'none') {
      progressBus.emit(executionId, {
        type: 'step_progress',
        subTask: '正在执行登录阶段...',
      });
      await this.runLoginStage(page, executionId, loginMethod);
    }

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

      // 5. 导航到目标 URL（登录阶段已完成且目标 URL 即登录页时跳过，避免跳回登录页导致业务步骤失败）
      const skipGoto =
        !!loginMethod?.loginUrl &&
        !!rawDoc.web?.url &&
        this.urlsEqual(rawDoc.web.url, loginMethod.loginUrl);

      if (skipGoto) {
        logger.info({ executionId, url: rawDoc.web!.url }, '目标 URL 即登录页，登录阶段后跳过重复导航');
      } else {
        progressBus.emit(executionId, {
          type: 'step_progress',
          subTask: `正在打开 ${rawDoc.web?.url}`,
        });

        await page.goto(rawDoc.web!.url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
      }

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
   * URL 规范化比较：忽略协议差异、末尾斜杠与 hash
   */
  private urlsEqual(a: string, b: string): boolean {
    const normalize = (u: string) =>
      u.trim().replace(/^https?:\/\//i, '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
    return normalize(a) === normalize(b);
  }

  /**
   * 登录阶段：以独立缓存 ID 执行登录 YAML（首次 AI 生成缓存，后续命中），
   * 执行完成后浏览器保持打开，供后续业务步骤继续使用。
   */
  private async runLoginStage(
    page: Page,
    executionId: string,
    lm: LoginMethodPayload,
  ): Promise<void> {
    const loginCacheId = `login_${lm.id}`;
    logger.info({ executionId, loginMethodId: lm.id, type: lm.type, cacheId: loginCacheId }, '开始登录阶段');

    const loginAgent = new PlaywrightAgent(page, {
      generateReport: false,
      cache: { id: loginCacheId },
    });

    try {
      if (lm.loginUrl) {
        await page.goto(lm.loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      const loginYaml = this.buildLoginYaml(lm);
      await loginAgent.runYaml(loginYaml);
      logger.info({ executionId, loginMethodId: lm.id, cacheId: loginCacheId }, '登录阶段执行成功');
      // 回调平台更新缓存状态（异步，不阻塞主流程）
      this.reportLoginCacheStatus(lm.id, 'cached').catch(() => {});
    } catch (err) {
      logger.error({ executionId, loginMethodId: lm.id, err }, '登录阶段执行失败');
      throw new Error(`登录阶段执行失败: ${(err as Error).message}`);
    } finally {
      await loginAgent.destroy().catch(() => {});
    }
  }

  /**
   * 构建登录 YAML：优先使用预生成的 yamlScript；
   * 否则按 账号/密码/补充步骤 模板拼接。
   * 补充步骤中以 [动态] 开头的行 → 该步骤标记 cacheable: false（验证码等动态内容不缓存）。
   */
  private buildLoginYaml(lm: LoginMethodPayload): string {
    if (lm.yamlScript && lm.yamlScript.trim()) {
      const doc = yaml.load(lm.yamlScript) as any;
      if (doc?.tasks) return yaml.dump({ tasks: doc.tasks });
      return lm.yamlScript;
    }

    const esc = (s?: string) => (s ?? '').replace(/'/g, "''");
    const lines: string[] = ['tasks:', '  - name: 登录', '    flow:'];
    lines.push(`      - aiInput: '${esc(lm.username)}'`);
    lines.push('        locate: 账号或用户名输入框');
    lines.push(`      - aiInput: '${esc(lm.password)}'`);
    lines.push('        locate: 密码输入框');

    if (lm.stepsNlp) {
      for (const raw of lm.stepsNlp.split('\n')) {
        const s = raw.trim();
        if (!s) continue;
        const dynamic = s.startsWith('[动态]');
        const text = dynamic ? s.slice(4).trim() : s;
        lines.push(`      - aiAct: '${esc(text)}'`);
        if (dynamic) lines.push('        cacheable: false');
      }
    }

    lines.push("      - aiAct: '点击登录按钮，完成登录'");
    // 等待登录跳转完成，避免业务步骤在页面加载中执行（查询类步骤永不缓存，不影响登录缓存复用）
    lines.push("      - aiWaitFor: '登录已完成，页面已进入登录后的主界面'");
    return lines.join('\n');
  }

  /**
   * 回调平台更新登录方式的缓存状态
   */
  private async reportLoginCacheStatus(loginMethodId: string, status: 'cached' | 'uncached'): Promise<void> {
    const base = getConfig().PLATFORM_BASE_URL;
    try {
      await fetch(`${base}/api/platform/login-methods/${encodeURIComponent(loginMethodId)}/cache-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      logger.info({ loginMethodId, status }, '登录方式缓存状态已回调');
    } catch (err) {
      logger.warn({ loginMethodId, status, err }, '登录方式缓存状态回调失败（忽略）');
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
