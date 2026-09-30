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
      // 缓存粒度控制：动态步骤（验证码/滑块/点选等每次都变）禁用 plan 缓存（缓存值必然过期），
      // 普通步骤照常读写缓存（提速）。多步指令按行拆分执行：动态行 cacheable:false，普通行正常缓存。
      // 剥离动态标签（标签只用于缓存判定，不能发给 AI——否则会被当成内容的一部分，
      // 例如 AI 把【动态】翻译成“记录不缓存”塞进输入值里）
      const cleanLine = (l: string) => l.replace(/[【\[]动态[】\]]\s*/g, '').trim();
      const lines = nlp.split('\n').map(cleanLine).filter(Boolean);
      const fileState: { lastDownloadPath?: string } = {};
      if (lines.length <= 1) {
        // 单步指令：优先识别自定义文件步骤，否则整条按动态与否决定缓存
        const handled = await this.tryCustomFileStep(page, agent, lines[0] || nlp, progressBus, executionId, fileState);
        if (!handled) {
          const dynamic = this.hasDynamicContent(nlp);
          if (dynamic) {
            logger.info({ executionId, caseId }, '单步指令含动态内容，本步禁用 plan 缓存');
          }
          await agent.aiAct(lines[0] || nlp, dynamic ? { cacheable: false } : undefined);
        }
      } else {
        // 多步指令：逐行执行（文件步骤自定义处理；动态行禁缓存；普通行正常缓存）
        for (let li = 0; li < lines.length; li++) {
          const rawLine = nlp.split('\n').map(l => l.trim()).filter(Boolean)[li] || lines[li];
          const line = lines[li];
          progressBus.emit(executionId, { type: 'step_progress', subTask: `执行步骤: ${line.slice(0, 60)}` });
          const handled = await this.tryCustomFileStep(page, agent, line, progressBus, executionId, fileState);
          if (handled) continue;
          const dynamic = this.hasDynamicContent(rawLine);
          if (dynamic) {
            logger.info({ executionId, caseId }, '步骤含动态内容，该步禁用 plan 缓存: %s', line.slice(0, 60));
          }
          await agent.aiAct(line, dynamic ? { cacheable: false } : undefined);
        }
      }
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

      // 8. 执行 runYaml（含自定义文件步骤 uploadFile/downloadFile/assertFile 时按段拆分执行）
      const hasCustomFileSteps = rawDoc.tasks?.some((t: any) =>
        Array.isArray(t?.flow) && t.flow.some((it: any) => it && typeof it === 'object'
          && ('uploadFile' in it || 'downloadFile' in it || 'assertFile' in it))
      );

      let runResult: any;
      if (hasCustomFileSteps) {
        logger.info({ executionId }, '检测到自定义文件步骤，启用分段执行');
        const segResults = await this.runTasksWithCustomSteps(agent, page, rawDoc, executionId, progressBus);
        runResult = { result: segResults };
      } else {
        runResult = await agent.runYaml(yamlTasks);
      }

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

  // ── 文件上传 / 下载 / 断言（自定义步骤） ─────────────────────────

  /**
   * NLP 行级自定义文件步骤识别。命中则执行并返回 true，否则返回 false 走普通 aiAct。
   * 支持的规范步骤（标准化 prompt 教学格式）：
   *   上传文件 C:\path\file.pdf 到上传控件   → aiAct + fileChooserAccept
   *   下载xx文件 / 点击下载                  → waitForEvent('download') + saveAs
   *   断言下载文件内容包含"xx" / 断言文件名包含"xx" → 读取并断言
   */
  private async tryCustomFileStep(
    page: Page,
    agent: PlaywrightAgent,
    line: string,
    progressBus: ProgressBus,
    executionId: string,
    state: { lastDownloadPath?: string },
  ): Promise<boolean> {
    // 上传文件
    const uploadMatch = line.match(/上传文件[：:\s]+['"]?([^\s，,'"]+)['"]?/);
    if (uploadMatch) {
      const filePath = uploadMatch[1];
      const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
      try {
        await fs.access(resolved);
      } catch {
        throw new Error(`上传文件不存在: ${resolved}`);
      }
      progressBus.emit(executionId, { type: 'step_progress', subTask: `上传文件: ${path.basename(resolved)}` });
      logger.info({ executionId, filePath: resolved }, '执行上传步骤');
      // 双机制覆盖：
      //  fileChooserAccept —— 预注册文件，原生文件选择框弹出时自动填充（QQ邮箱附件按钮场景）
      //  fileChooserAllowedDir —— 允许 AI 在规划中主动调用 RegisterFileChooserAccept 动作从该目录选文件
      await agent.aiAct(line, {
        fileChooserAccept: resolved,
        fileChooserAllowedDir: path.dirname(resolved),
      } as any);
      return true;
    }

    // 下载文件（点击触发下载）
    if (/^下载|点击下载|下载文件/.test(line)) {
      progressBus.emit(executionId, { type: 'step_progress', subTask: `执行下载: ${line.slice(0, 50)}` });
      const downloadDir = path.resolve('midscene_run/downloads');
      await fs.mkdir(downloadDir, { recursive: true });
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
      await agent.aiAct(line);
      const download = await downloadPromise;
      if (!download) {
        logger.warn({ executionId }, '下载步骤未捕获到 download 事件（可能目标不是下载链接）');
        return true; // 不视为失败：目标可能通过弹窗/新页签完成
      }
      const savePath = path.join(downloadDir, download.suggestedFilename());
      await download.saveAs(savePath);
      state.lastDownloadPath = savePath;
      logger.info({ executionId, savePath }, '文件已下载');
      progressBus.emit(executionId, { type: 'step_progress', subTask: `文件已下载: ${download.suggestedFilename()}` });
      return true;
    }

    // 断言文件（读取并断言内容/标题）
    if (/(断言|验证).{0,8}文件/.test(line)) {
      const target = await this.resolveAssertTarget(line, state);
      const content = await fs.readFile(target, 'utf8').catch(() => {
        throw new Error(`无法读取文件内容: ${target}（暂支持文本类文件）`);
      });
      const fileName = path.basename(target);
      const containsMatch = line.match(/内容[中里]?包含["'“”]([^"'“”]+)["'“”]/) || line.match(/包含["'“”]([^"'“”]+)["'“”]/);
      const titleMatch = line.match(/(?:文件名|标题)[中里]?包含["'“”]([^"'“”]+)["'“”]/);
      if (titleMatch && !fileName.includes(titleMatch[1])) {
        throw new Error(`断言失败: 文件名 "${fileName}" 不包含 "${titleMatch[1]}"`);
      }
      if (containsMatch && !content.includes(containsMatch[1])) {
        throw new Error(`断言失败: 文件内容不包含 "${containsMatch[1]}"（文件: ${fileName}，大小 ${content.length} 字符）`);
      }
      if (!containsMatch && !titleMatch) {
        // 无具体断言目标：交由 AI 对文件内容断言
        const summary = content.slice(0, 4000);
        const verdict = await agent.aiAssert(`以下文件(${fileName})内容满足描述"${line}"。文件内容：\n${summary}`).catch((e: any) => ({ pass: false, message: String(e) })) as any;
        if (verdict && verdict.pass === false) {
          throw new Error(`AI 断言失败: ${verdict.message || line}`);
        }
      }
      logger.info({ executionId, target }, '文件断言通过');
      progressBus.emit(executionId, { type: 'step_progress', subTask: `文件断言通过: ${fileName}` });
      return true;
    }

    return false;
  }

  /** 解析断言目标文件：行内显式路径 > 上一步下载的文件 */
  private async resolveAssertTarget(line: string, state: { lastDownloadPath?: string }): Promise<string> {
    const pathMatch = line.match(/['"]?([A-Za-z]:\\[^\s，,'"]+|[^\s，,'"]+\.(txt|csv|json|log|md|html|xml|yaml|yml|pdf|xlsx?|docx?))['"]?/i);
    if (pathMatch) {
      const p = pathMatch[1];
      const resolved = path.isAbsolute(p) ? p : path.resolve('midscene_run/downloads', p);
      try { await fs.access(resolved); return resolved; } catch { /* fall through */ }
    }
    if (state.lastDownloadPath) return state.lastDownloadPath;
    throw new Error('断言文件步骤缺少目标：未指定文件路径，且本次执行尚未下载任何文件');
  }

  /**
   * YAML 模式：任务流分段执行（自定义文件步骤拆分 runYaml 段）
   */
  private async runTasksWithCustomSteps(
    agent: PlaywrightAgent,
    page: Page,
    rawDoc: YamlDoc,
    executionId: string,
    progressBus: ProgressBus,
  ): Promise<any[]> {
    const state: { lastDownloadPath?: string } = {};
    const results: any[] = [];

    for (const task of rawDoc.tasks) {
      const flow: any[] = task.flow || [];
      let segment: any[] = [];

      const flushSegment = async () => {
        if (segment.length === 0) return;
        const segYaml = yaml.dump({ tasks: [{ name: task.name, flow: segment }] });
        const r: any = await agent.runYaml(segYaml);
        if (r?.result) results.push(...(Array.isArray(r.result) ? r.result : [r.result]));
        segment = [];
      };

      for (const item of flow) {
        if (item && typeof item === 'object' && ('uploadFile' in item || 'downloadFile' in item || 'assertFile' in item)) {
          await flushSegment();
          await this.executeYamlFileStep(page, agent, item, progressBus, executionId, state);
        } else {
          segment.push(item);
        }
      }
      await flushSegment();
    }
    return results;
  }

  /** YAML 自定义文件步骤执行 */
  private async executeYamlFileStep(
    page: Page,
    agent: PlaywrightAgent,
    item: any,
    progressBus: ProgressBus,
    executionId: string,
    state: { lastDownloadPath?: string },
  ): Promise<void> {
    if ('uploadFile' in item) {
      const file = String(item.file || '');
      const resolved = path.isAbsolute(file) ? file : path.resolve(file);
      try { await fs.access(resolved); } catch { throw new Error(`uploadFile 文件不存在: ${resolved}`); }
      progressBus.emit(executionId, { type: 'step_progress', subTask: `上传文件: ${path.basename(resolved)}` });
      await agent.aiAct(`点击${item.uploadFile}`, {
        fileChooserAccept: resolved,
        fileChooserAllowedDir: path.dirname(resolved),
      } as any);
      return;
    }
    if ('downloadFile' in item) {
      const downloadDir = path.resolve('midscene_run/downloads');
      await fs.mkdir(downloadDir, { recursive: true });
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
      await agent.aiAct(`点击${item.downloadFile}`);
      const download = await downloadPromise;
      if (!download) throw new Error('downloadFile 步骤未捕获到下载事件');
      const saveName = String(item.file || download.suggestedFilename());
      const savePath = path.join(downloadDir, saveName);
      await download.saveAs(savePath);
      state.lastDownloadPath = savePath;
      progressBus.emit(executionId, { type: 'step_progress', subTask: `文件已下载: ${saveName}` });
      return;
    }
    // assertFile
    const targetName = String(item.assertFile || '');
    let target = path.isAbsolute(targetName) ? targetName : path.resolve('midscene_run/downloads', targetName);
    try { await fs.access(target); } catch {
      if (state.lastDownloadPath) target = state.lastDownloadPath;
      else throw new Error(`assertFile 文件不存在: ${target}`);
    }
    const fileName = path.basename(target);
    if (item.titleContains && !fileName.includes(String(item.titleContains))) {
      throw new Error(`断言失败: 文件名 "${fileName}" 不包含 "${item.titleContains}"`);
    }
    if (item.contains) {
      const content = await fs.readFile(target, 'utf8').catch(() => {
        throw new Error(`无法读取文件内容: ${target}（暂支持文本类文件）`);
      });
      if (!content.includes(String(item.contains))) {
        throw new Error(`断言失败: 文件内容不包含 "${item.contains}"（文件: ${fileName}）`);
      }
    }
    progressBus.emit(executionId, { type: 'step_progress', subTask: `文件断言通过: ${fileName}` });
  }

  /**
   * 动态内容检测：显式标签（【动态】/[动态]）或动态关键词（验证码/滑块/点选/随机数/当前日期等）。
   * 命中即禁用本次 aiAct 的 plan 缓存——plan 缓存固化的是 AI 规划时识别的具体值
   * （如验证码文本 "Na 47Jg"），重放必然过期；禁用后 AI 每次执行重新识别。
   */
  private hasDynamicContent(text: string): boolean {
    if (!text) return false;
    if (/[【\[]动态[】\]]/.test(text)) return true;
    const dynamicKeyword = new RegExp(
      '验证码|captcha|滑块|滑动验证|点选|图形码|' +
      '短信.{0,4}(码|验证)|邮箱.{0,4}(码|验证)|邮件.{0,4}(码|验证)|' +
      '动态(密码|口令|值)|一次性(密码|口令|验证)|' +
      '随机(数|码|值)|验证字符|' +
      '当前日期|今天日期|当日日期|当前时间|时间戳|uuid',
      'i',
    );
    return dynamicKeyword.test(text.replace(/\s+/g, ''));
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
