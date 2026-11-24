import path from 'node:path';
import fs from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { PlaywrightAgent } from '@midscene/web/playwright';
import type { LoginMethodPayload } from '../models/test-case.js';
import type { ExecutionResult, StepResult } from '../models/execution.js';
import type { ProgressBus } from '../progress/bus.js';
import type { CancelManager } from './cancel-manager.js';
import { YamlRunner } from './yaml-runner.js';
import type { ApiExchangeProducer } from '../observability/kafka.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

/** 单步 selector 尝试超时（定位 + 动作各一次） */
const STEP_TIMEOUT_MS = 15000;
/** selector 链最多尝试条数（与录制器 MAX_SELECTORS 对齐） */
const MAX_SELECTORS = 3;

/** 注入给录制脚本的受限 stp 上下文（生成的脚本只调用该 API 面，不暴露 require/process/fs） */
export interface StpRunner {
  page: Page;
  goto(page: Page, url: string): Promise<void>;
  click(page: Page, sels: string[], prompt: string): Promise<void>;
  dblclick(page: Page, sels: string[], prompt: string): Promise<void>;
  hover(page: Page, sels: string[], prompt: string): Promise<void>;
  fill(page: Page, sels: string[], prompt: string, value: string): Promise<void>;
  keyboard(page: Page, key: string, prompt: string): Promise<void>;
  ai(page: Page, prompt: string): Promise<void>;
  aiAssert(page: Page, prompt: string): Promise<void>;
  aiWaitFor(page: Page, prompt: string): Promise<void>;
  upload(page: Page, sels: string[], prompt: string, filePath: string): Promise<void>;
  download(page: Page, sels: string[], prompt: string, fileName?: string): Promise<void>;
  assertFile(prompt: string, target?: string, contains?: string): Promise<void>;
  evaluate(page: Page, code: string, prompt: string): Promise<void>;
}

/** CODE 模式步骤执行记录（自建轻量报告的数据源） */
interface CodeStepRecord {
  index: number;
  type: string;
  semantic: string;
  code: string;
  status: 'passed' | 'failed';
  duration: number;
  aiFallback?: boolean;
  aiStep?: boolean;
  error?: string;
  screenshot?: string;
}

/**
 * CODE 执行模式 Runner
 *
 * 执行录制脚本（Playwright TS/JS 代码）：
 *   1. 复用 YamlRunner 的登录阶段（login_{methodId} 独立缓存）与 NetworkObserver（sw8 染色 + Kafka 报文）；
 *   2. 业务阶段经 new Function 注入受限 stp 上下文执行脚本（无 LLM 调用）；
 *   3. Midscene agent 惰性创建：仅在 @ai 步骤或元素定位失败兜底时实例化（attach 同一 page，
 *      共用同一 caseId 缓存——兜底新命中自动回写 locate 缓存，反哺下次录制）；
 *   4. 产出轻量 HTML 报告（步骤表 + AI 兜底标记 + 异常步骤截图），走 Worker 层既有报告上传通道。
 */
export class CodeRunner {
  private yamlRunner = new YamlRunner();

  async run(
    executionId: string,
    caseId: string,
    caseName: string,
    script: string,
    headless: boolean,
    progressBus: ProgressBus,
    cancelManager: CancelManager,
    cacheContent?: string,
    reportFileName?: string,
    producer?: ApiExchangeProducer,
    trafficTaggingEnabled = false,
    loginMethod?: LoginMethodPayload,
    targetUrl?: string,
    screenshotMode?: 'ERROR' | 'ALL',
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    // 步骤截图模式：ERROR=仅失败/AI兜底步骤（默认，控制报告体积）；ALL=每步截图（人工审读）
    const screenshotAll = (screenshotMode ?? 'ERROR') === 'ALL';

    // 平台下发的 locate 缓存先落盘（兜底 agent 复用；兜底命中后由 Worker 回传）
    const cacheDir = path.resolve('midscene_run/cache');
    await fs.mkdir(cacheDir, { recursive: true });
    if (cacheContent) {
      await fs.writeFile(path.join(cacheDir, `${caseId}.cache.yaml`), cacheContent, 'utf8');
    }

    const browser = await chromium.launch({ headless, channel: 'chrome', args: ['--ignore-certificate-errors'] });
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const observer = this.yamlRunner.createNetworkObserver(executionId, caseId, producer, trafficTaggingEnabled);
    await observer?.install(context);
    const page = await context.newPage();

    // 登录阶段：复用现有逻辑（独立缓存、成功回调 cache-status、浏览器不关闭）
    if (loginMethod && loginMethod.type && loginMethod.type !== 'none') {
      progressBus.emit(executionId, { type: 'step_progress', subTask: '正在执行登录阶段...' });
      await this.yamlRunner.runLoginStage(page, executionId, loginMethod);
    }

    // 目标页导航（与登录页相同则跳过，避免跳回登录页——语义与 NLP 模式一致）
    if (targetUrl && !(loginMethod?.loginUrl && this.yamlRunner.urlsEqual(targetUrl, loginMethod.loginUrl))) {
      progressBus.emit(executionId, { type: 'step_progress', subTask: `正在打开 ${targetUrl}` });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    const steps: CodeStepRecord[] = [];
    const fileState: { lastDownloadPath?: string } = {};
    const agentHolder: { agent: PlaywrightAgent | null } = { agent: null };

    const checkCancelled = () => {
      if (cancelManager.isCancelled(executionId)) throw new Error('执行已取消');
    };
    const getAgent = async (): Promise<PlaywrightAgent> => {
      if (!agentHolder.agent) {
        // 惰性创建：仅 @ai 步骤 / 兜底时才实例化 Midscene；generateReport:false（CODE 报告为自建轻量报告）
        agentHolder.agent = new PlaywrightAgent(page, { generateReport: false, cache: { id: caseId } });
      }
      return agentHolder.agent;
    };
    const shot = async (): Promise<string | undefined> => {
      try {
        const buf = await page.screenshot({ type: 'jpeg', quality: 60 });
        return buf.toString('base64');
      } catch {
        return undefined;
      }
    };
    // 全步骤截图模式（配置 screenshotMode=ALL）：成功步骤也截图（同步等待，保证截到本步后的状态）
    const shotAll = (): Promise<string | undefined> => (screenshotAll ? shot() : Promise.resolve(undefined));
    const record = (rec: Omit<CodeStepRecord, 'index'>): void => {
      const entry: CodeStepRecord = { index: steps.length + 1, ...rec };
      steps.push(entry);
      progressBus.emit(executionId, {
        type: 'step_progress',
        subTask: `${entry.status === 'passed' ? '✓' : '✗'} [${entry.index}] ${entry.semantic}${entry.aiFallback || entry.aiStep ? '（AI）' : ''}`,
      });
    };
    const fail = (semantic: string, code: string, err: unknown, startMs: number, aiFallback = false): never => {
      const message = (err as Error)?.message ?? String(err);
      record({
        type: 'step', semantic, code, status: 'failed', duration: Date.now() - startMs,
        aiFallback, error: message, screenshot: undefined,
      });
      // 截图异步补偿（失败步骤必拍）
      shot().then((s) => { if (s) entryOf(steps, semantic).screenshot = s; }).catch(() => {});
      throw new Error(`步骤失败${aiFallback ? '（已尝试 AI 兜底）' : ''}: ${semantic} — ${message}`);
    };

    // selector 链依次尝试：返回命中的 selector；全失败返回 null
    const tryLocators = async (
      sels: string[],
      action: (locator: import('playwright').Locator) => Promise<void>,
    ): Promise<string | null> => {
      for (const sel of sels.slice(0, MAX_SELECTORS)) {
        try {
          const locator = page.locator(sel);
          await locator.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS });
          await action(locator);
          return sel;
        } catch {
          // 尝试下一条候选
        }
      }
      return null;
    };

    // ── stp 受限上下文 ──
    const stp: StpRunner = {
      page,
      async goto(p: Page, url: string) {
        checkCancelled();
        const start = Date.now();
        try {
          if (!url) return;
          if (!p.url() || !codeRunnerUrlsEqual(p.url(), url)) {
            await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          }
          record({ type: 'goto', semantic: `打开 ${url}`, code: `goto ${url}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
        } catch (err) {
          fail(`打开 ${url}`, `goto ${url}`, err, start);
        }
      },
      async click(p: Page, sels: string[], prompt: string) {
        checkCancelled();
        const start = Date.now();
        const code = sels.length ? `click ${sels[0]}` : `aiTap ${prompt}`;
        try {
          const hit = await tryLocators(sels, (loc) => loc.click({ timeout: STEP_TIMEOUT_MS }));
          if (hit) {
            record({ type: 'click', semantic: prompt, code: `click ${hit}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
            return;
          }
          // AI 兜底：以步骤语义为 prompt
          const agent = await getAgent();
          await agent.aiTap(prompt);
          record({
            type: 'click', semantic: prompt, code, status: 'passed', duration: Date.now() - start,
            aiFallback: true, screenshot: await shot(),
          });
        } catch (err) {
          fail(prompt, code, err, start, true);
        }
      },
      async dblclick(p: Page, sels: string[], prompt: string) {
        checkCancelled();
        const start = Date.now();
        const code = sels.length ? `dblclick ${sels[0]}` : `aiDoubleClick ${prompt}`;
        try {
          const hit = await tryLocators(sels, (loc) => loc.dblclick({ timeout: STEP_TIMEOUT_MS }));
          if (hit) {
            record({ type: 'dblclick', semantic: prompt, code: `dblclick ${hit}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
            return;
          }
          const agent = await getAgent();
          await agent.aiDoubleClick(prompt);
          record({
            type: 'dblclick', semantic: prompt, code, status: 'passed', duration: Date.now() - start,
            aiFallback: true, screenshot: await shot(),
          });
        } catch (err) {
          fail(prompt, code, err, start, true);
        }
      },
      async hover(p: Page, sels: string[], prompt: string) {
        checkCancelled();
        const start = Date.now();
        const code = sels.length ? `hover ${sels[0]}` : `aiHover ${prompt}`;
        try {
          const hit = await tryLocators(sels, (loc) => loc.hover({ timeout: STEP_TIMEOUT_MS }));
          if (hit) {
            record({ type: 'hover', semantic: prompt, code: `hover ${hit}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
            return;
          }
          const agent = await getAgent();
          await agent.aiHover(prompt);
          record({
            type: 'hover', semantic: prompt, code, status: 'passed', duration: Date.now() - start,
            aiFallback: true, screenshot: await shot(),
          });
        } catch (err) {
          fail(prompt, code, err, start, true);
        }
      },
      async fill(p: Page, sels: string[], prompt: string, value: string) {
        checkCancelled();
        const start = Date.now();
        const code = sels.length ? `fill ${sels[0]} <= '${value}'` : `aiInput ${prompt}`;
        // 空语义且无 selector：承接上一步聚焦的元素，直接键入（无法用 AI 兜底——aiInput 空定位会被拒绝）
        if (!sels.length && !prompt) {
          try {
            await p.keyboard.type(value);
            record({ type: 'fill', semantic: `键入 ${value}`, code: `keyboard.type '${value}'`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
          } catch (err) {
            fail(`键入 ${value}`, `keyboard.type '${value}'`, err, start);
          }
          return;
        }
        try {
          const hit = await tryLocators(sels, (loc) => loc.fill(value, { timeout: STEP_TIMEOUT_MS }));
          if (hit) {
            record({ type: 'fill', semantic: prompt, code: `fill ${hit}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
            return;
          }
          const agent = await getAgent();
          await agent.aiInput(prompt, { value });
          record({
            type: 'fill', semantic: prompt, code, status: 'passed', duration: Date.now() - start,
            aiFallback: true, screenshot: await shot(),
          });
        } catch (err) {
          // 空语义兜底拒绝：降级为键入到当前聚焦元素
          if (!prompt) {
            try {
              await p.keyboard.type(value);
              record({ type: 'fill', semantic: `键入 ${value}`, code: `keyboard.type '${value}'`, status: 'passed', duration: Date.now() - start, aiFallback: true, screenshot: await shotAll() });
              return;
            } catch { /* fall through 抛出原错误 */ }
          }
          fail(prompt, code, err, start, true);
        }
      },
      async keyboard(p: Page, key: string, prompt: string) {
        checkCancelled();
        const start = Date.now();
        try {
          await p.keyboard.press(key);
          record({ type: 'keyboard', semantic: prompt, code: `keyboard.press ${key}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
        } catch (err) {
          fail(prompt, `keyboard.press ${key}`, err, start);
        }
      },
      async ai(_p: Page, prompt: string) {
        checkCancelled();
        const start = Date.now();
        try {
          const agent = await getAgent();
          await agent.aiAct(prompt);
          record({
            type: 'ai', semantic: prompt, code: `aiAct ${prompt}`, status: 'passed',
            duration: Date.now() - start, aiStep: true, screenshot: await shotAll(),
          });
        } catch (err) {
          fail(prompt, `aiAct ${prompt}`, err, start);
        }
      },
      async aiAssert(_p: Page, prompt: string) {
        checkCancelled();
        const start = Date.now();
        try {
          const agent = await getAgent();
          const verdict: any = await agent.aiAssert(prompt).catch((e: unknown) => ({ pass: false, message: String(e) }));
          if (verdict && verdict.pass === false) {
            throw new Error(verdict.message || prompt);
          }
          record({
            type: 'assert', semantic: prompt, code: `aiAssert ${prompt}`, status: 'passed',
            duration: Date.now() - start, aiStep: true, screenshot: await shotAll(),
          });
        } catch (err) {
          fail(prompt, `aiAssert ${prompt}`, err, start);
        }
      },
      async aiWaitFor(_p: Page, prompt: string) {
        checkCancelled();
        const start = Date.now();
        try {
          const agent = await getAgent();
          await agent.aiWaitFor(prompt);
          record({
            type: 'waitfor', semantic: prompt, code: `aiWaitFor ${prompt}`, status: 'passed',
            duration: Date.now() - start, aiStep: true, screenshot: await shotAll(),
          });
        } catch (err) {
          fail(prompt, `aiWaitFor ${prompt}`, err, start);
        }
      },
      async upload(p: Page, sels: string[], prompt: string, filePath: string) {
        checkCancelled();
        const start = Date.now();
        const code = `upload ${filePath}`;
        try {
          const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
          await fs.access(resolved);
          // 双机制与 yaml-runner 一致：优先 selector 点击 + filechooser 事件；
          // 无 selector 命中时走 Midscene（fileChooserAccept 预注册）
          const chooserPromise = p.waitForEvent('filechooser', { timeout: STEP_TIMEOUT_MS });
          const hit = await tryLocators(sels, (loc) => loc.click({ timeout: STEP_TIMEOUT_MS }));
          if (hit) {
            const chooser = await chooserPromise;
            await chooser.setFiles(resolved);
            record({ type: 'upload', semantic: prompt, code: `upload ${hit} <= ${resolved}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
            return;
          }
          const agent = await getAgent();
          await agent.aiAct(`点击${prompt}`, {
            fileChooserAccept: resolved,
            fileChooserAllowedDir: path.dirname(resolved),
          } as any);
          record({
            type: 'upload', semantic: prompt, code, status: 'passed', duration: Date.now() - start,
            aiFallback: true, screenshot: await shot(),
          });
        } catch (err) {
          fail(prompt, code, err, start, true);
        }
      },
      async download(p: Page, sels: string[], prompt: string, fileName?: string) {
        checkCancelled();
        const start = Date.now();
        const code = `download ${prompt}`;
        try {
          const downloadDir = path.resolve('midscene_run/downloads');
          await fs.mkdir(downloadDir, { recursive: true });
          const downloadPromise = p.waitForEvent('download', { timeout: 60000 }).catch(() => null);
          const hit = await tryLocators(sels, (loc) => loc.click({ timeout: STEP_TIMEOUT_MS }));
          if (!hit) {
            const agent = await getAgent();
            await agent.aiAct(prompt);
          }
          const download = await downloadPromise;
          if (!download) {
            throw new Error('下载步骤未捕获到 download 事件（可能目标不是下载链接）');
          }
          const saveName = fileName || download.suggestedFilename();
          const savePath = path.join(downloadDir, saveName);
          await download.saveAs(savePath);
          fileState.lastDownloadPath = savePath;
          record({
            type: 'download', semantic: prompt, code: `download -> ${saveName}`, status: 'passed',
            duration: Date.now() - start, aiFallback: !hit, screenshot: await shotAll(),
          });
        } catch (err) {
          fail(prompt, code, err, start, true);
        }
      },
      async assertFile(prompt: string, target?: string, contains?: string) {
        checkCancelled();
        const start = Date.now();
        const code = `assertFile ${target ?? '(最近下载)'}`;
        try {
          let file: string | undefined;
          if (target && path.isAbsolute(target)) {
            file = target;
          } else if (target) {
            file = path.resolve('midscene_run/downloads', target);
          }
          if (!file || !await fs.access(file).then(() => true, () => false)) {
            file = fileState.lastDownloadPath;
          }
          if (!file) {
            throw new Error('断言文件步骤缺少目标：未指定文件路径，且本次执行尚未下载任何文件');
          }
          const fileName = path.basename(file);
          // 行内断言目标解析（与 yaml-runner tryCustomFileStep 的断言规则一致）
          const containsMatch = contains
            || prompt.match(/内容[中里]?包含["'“”]([^"'“”]+)["'“”]/)?.[1]
            || prompt.match(/包含["'“”]([^"'“”]+)["'“”]/)?.[1];
          const titleMatch = prompt.match(/(?:文件名|标题)[中里]?包含["'“”]([^"'“”]+)["'“”]/)?.[1];
          if (titleMatch && !fileName.includes(titleMatch)) {
            throw new Error(`断言失败: 文件名 "${fileName}" 不包含 "${titleMatch}"`);
          }
          const content = await fs.readFile(file, 'utf8');
          if (containsMatch && !content.includes(containsMatch)) {
            throw new Error(`断言失败: 文件内容不包含 "${containsMatch}"（文件: ${fileName}）`);
          }
          record({ type: 'assertFile', semantic: prompt, code: `assertFile ${fileName}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
        } catch (err) {
          fail(prompt, code, err, start);
        }
      },
      async evaluate(p: Page, codeStr: string, prompt: string) {
        checkCancelled();
        const start = Date.now();
        try {
          await p.evaluate(codeStr);
          record({ type: 'evaluate', semantic: prompt, code: `evaluate ${prompt}`, status: 'passed', duration: Date.now() - start, screenshot: await shotAll() });
        } catch (err) {
          fail(prompt, `evaluate ${prompt}`, err, start);
        }
      },
    };

    // ── 注入执行录制脚本 ──
    let status: 'completed' | 'failed' = 'completed';
    let runError: string | undefined;
    try {
      if (cancelManager.isCancelled(executionId)) {
        return this.cancelledResult(executionId);
      }
      progressBus.emit(executionId, { type: 'step_progress', subTask: '正在执行录制脚本（Playwright 代码模式）...' });

      // 脚本为系统录制生成（不含登录凭据），经 new Function 注入受限 stp 上下文执行；
      // 脚本须定义 async function run(stp)
      const factory = new Function('stp', `"use strict";\n${script}\n;return run(stp);`);
      const runFn = factory(stp);
      if (typeof runFn?.then !== 'function') {
        throw new Error('录制脚本格式无效：未定义 async function run(stp)');
      }
      await runFn;
    } catch (err) {
      status = 'failed';
      runError = (err as Error)?.message ?? String(err);
      logger.warn({ executionId, caseId, err: runError }, 'CODE 执行失败');
    } finally {
      await observer?.flush();
      await agentHolder.agent?.destroy().catch(() => {});
      await browser.close().catch(() => {});
      cancelManager.remove(executionId);
    }

    // ── 轻量 HTML 报告（走 Worker 层既有报告上传通道） ──
    const durationMs = Date.now() - startTime;
    const aiCount = steps.filter((s) => s.aiFallback || s.aiStep).length;
    const failedCount = steps.filter((s) => s.status === 'failed').length;
    const reportHtml = buildCodeReportHtml({
      caseName, executionId, caseId, status, runError, durationMs, aiCount, steps,
      apiExchanges: observer?.summary() ?? [],
    });
    try {
      const reportDir = path.resolve(getConfig().REPORT_DIR);
      await fs.mkdir(reportDir, { recursive: true });
      await fs.writeFile(path.join(reportDir, `${reportFileName || executionId}.html`), reportHtml, 'utf8');
    } catch (err) {
      logger.warn({ executionId, err }, 'CODE 报告落盘失败（忽略）');
    }

    const stepResults: StepResult[] = steps.map((s) => ({
      index: s.index,
      type: s.type,
      status: s.status,
      duration: s.duration,
      error: s.error,
    }));

    return {
      executionId,
      status,
      tasks: [{
        name: `${caseName || caseId}（CODE）`,
        status: failedCount === 0 && status === 'completed' ? 'passed' : 'failed',
        steps: stepResults,
      }],
      reportUrl: null,
    };
  }

  private cancelledResult(executionId: string): ExecutionResult {
    return { executionId, status: 'failed', tasks: [], reportUrl: null };
  }
}

/** 失败截图异步补偿：回填到最近一条与 semantic 匹配的记录 */
function entryOf(steps: CodeStepRecord[], semantic: string): CodeStepRecord {
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].semantic === semantic) return steps[i];
  }
  return steps[steps.length - 1];
}

/** URL 规范化比较（与 YamlRunner.urlsEqual 同语义） */
function codeRunnerUrlsEqual(a: string, b: string): boolean {
  const normalize = (u: string) =>
    u.trim().replace(/^https?:\/\//i, '').replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();
  return normalize(a) === normalize(b);
}

// ── 轻量 HTML 报告 ─────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface ReportMeta {
  caseName: string;
  executionId: string;
  caseId: string;
  status: 'completed' | 'failed';
  runError?: string;
  durationMs: number;
  aiCount: number;
  steps: CodeStepRecord[];
  /** 执行期间观测到的接口请求摘要（NetworkObserver 内存摘要，不依赖 Kafka） */
  apiExchanges: ReadonlyArray<{ method: string; url: string; status?: number; durationMs?: number; error?: string; startedAt: string }>;
}

function buildCodeReportHtml(meta: ReportMeta): string {
  const failed = meta.steps.filter((s) => s.status === 'failed').length;
  const rows = meta.steps.map((s) => {
    const badge = s.status === 'passed'
      ? '<span class="badge ok">通过</span>'
      : '<span class="badge fail">失败</span>';
    const aiMark = s.aiFallback
      ? '<span class="badge ai">AI 兜底</span>'
      : (s.aiStep ? '<span class="badge ai">AI 步骤</span>' : '');
    const shot = s.screenshot
      ? `<div class="shot"><img src="data:image/jpeg;base64,${s.screenshot}" alt="step screenshot"/></div>`
      : '';
    const err = s.error ? `<div class="err">${escapeHtml(s.error)}</div>` : '';
    return `<tr>
  <td>${s.index}</td>
  <td><code>${escapeHtml(s.code)}</code></td>
  <td>${escapeHtml(s.semantic)} ${aiMark}</td>
  <td>${badge}</td>
  <td>${(s.duration / 1000).toFixed(1)}s</td>
  <td>${err}${shot}</td>
</tr>`;
  }).join('\n');

  // 接口请求区块（fetch/XHR 观测摘要；Kafka 全量报文仍在报告中心「接口记录」Tab）
  const apiRows = meta.apiExchanges.map((e) => {
    const statusBadge = e.error
      ? '<span class="badge fail">失败</span>'
      : (e.status != null && e.status >= 400 ? `<span class="badge fail">${e.status}</span>` : `<span class="badge ok">${e.status ?? '-'}</span>`);
    return `<tr>
  <td><code>${escapeHtml(e.method)}</code></td>
  <td><code>${escapeHtml(e.url)}</code></td>
  <td>${statusBadge}</td>
  <td>${e.durationMs != null ? `${e.durationMs}ms` : '-'}</td>
  <td>${e.error ? `<span class="err">${escapeHtml(e.error)}</span>` : ''}</td>
</tr>`;
  }).join('\n');
  const apiSection = meta.apiExchanges.length > 0
    ? `<table>
<thead><tr><th style="width:70px">方法</th><th>URL</th><th style="width:80px">状态码</th><th style="width:80px">耗时</th><th style="width:26%">错误</th></tr></thead>
<tbody>
${apiRows}
</tbody>
</table>
<p style="font-size:12px;color:#909399">完整报文（含请求/响应体、Trace 拓扑）请在报告中心该报告的「接口记录」页签查看。</p>`
    : '<div class="meta"><div><b>接口请求：</b>本次执行未观测到业务接口请求（fetch/XHR）</div></div>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>CODE 执行报告 - ${escapeHtml(meta.caseName)}</title>
<style>
body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;margin:0;background:#f5f7fa;color:#303133}
.wrap{max-width:1080px;margin:24px auto;padding:0 16px}
h1{font-size:20px}
.meta{background:#fff;border-radius:10px;padding:16px 20px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:16px;display:flex;flex-wrap:wrap;gap:24px}
.meta div{font-size:14px}
.meta b{color:#606266}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.06)}
th,td{padding:10px 12px;font-size:13px;text-align:left;border-bottom:1px solid #ebeef5;vertical-align:top}
th{background:#f5f7fa;color:#606266;font-weight:600}
code{font-family:Consolas,monospace;background:#f0f2f5;padding:1px 5px;border-radius:4px;word-break:break-all}
.badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:12px;margin-left:4px}
.badge.ok{background:#f0f9eb;color:#67c23a;border:1px solid #e1f3d8}
.badge.fail{background:#fef0f0;color:#f56c6c;border:1px solid #fde2e2}
.badge.ai{background:#fdf6ec;color:#e6a23c;border:1px solid #faecd8}
.err{color:#f56c6c;font-size:12px;margin-top:4px;word-break:break-all}
.shot img{max-width:520px;margin-top:6px;border:1px solid #ebeef5;border-radius:6px}
.status-completed{color:#67c23a}.status-failed{color:#f56c6c}
</style>
</head>
<body>
<div class="wrap">
<h1>CODE 执行报告</h1>
<div class="meta">
  <div><b>用例：</b>${escapeHtml(meta.caseName)}</div>
  <div><b>执行模式：</b>CODE（Playwright 代码执行）</div>
  <div><b>结果：</b><span class="status-${meta.status}">${meta.status === 'completed' ? '成功' : '失败'}</span></div>
  <div><b>步骤：</b>${meta.steps.length}（失败 ${failed}，AI ${meta.aiCount}）</div>
  <div><b>总耗时：</b>${(meta.durationMs / 1000).toFixed(1)}s</div>
  <div><b>执行ID：</b>${escapeHtml(meta.executionId)}</div>
</div>
${meta.runError ? `<div class="meta" style="border-left:4px solid #f56c6c"><div><b>错误：</b><span style="color:#f56c6c">${escapeHtml(meta.runError)}</span></div></div>` : ''}
<table>
<thead><tr><th style="width:40px">#</th><th style="width:28%">代码</th><th>步骤语义</th><th style="width:80px">结果</th><th style="width:70px">耗时</th><th style="width:34%">错误 / 截图</th></tr></thead>
<tbody>
${rows || '<tr><td colspan="6">无步骤记录</td></tr>'}
</tbody>
</table>
<h2 style="font-size:16px;margin:20px 0 10px">接口请求</h2>
${apiSection}
<p style="font-size:12px;color:#909399">说明：AI 兜底 = Playwright 定位失败后由 Midscene 以步骤语义重试命中；AI 步骤 = 录制时标记的 @ai 步骤（复杂断言/动态值），执行时直接走 Midscene。兜底命中会回写用例 locate 缓存。</p>
</div>
</body>
</html>`;
}
