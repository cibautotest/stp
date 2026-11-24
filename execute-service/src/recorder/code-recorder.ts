import yaml from 'js-yaml';
import path from 'node:path';
import fs from 'node:fs/promises';
import { logger } from '../utils/logger.js';
import { hasDynamicContent, stripDynamicTag } from '../utils/dynamic-content.js';
import { takeDumpCollector } from './dump-collector.js';
import type { RecordableStep } from './types.js';

/**
 * 录制器：NLP/YAML 执行成功后，把执行过程翻译为可重放的 Playwright TS 脚本。
 *
 * 数据源（双保险）：
 *   1. Midscene locate 缓存（midscene_run/cache/{caseId}.cache.yaml）：
 *      type:'plan' 条目 yamlWorkflow = 步骤骨架（动作+值+locate 语义）；
 *      type:'locate' 条目 cache.xpaths = 每步命中元素的 XPath（含文本谓词）。
 *   2. DumpCollector（onDumpUpdate 实时钩子）：执行期间收集的 prompt → xpath 命中。
 *
 * 翻译规则（见 openspec/changes/playwright-code-execution/design.md §2.3 动作映射表）：
 *   可确定性翻译的步骤 → stp 包装调用（selector 链 + 语义注释兜底）；
 *   复杂断言 / aiWaitFor / [动态] 步骤 / 无定位信息的步骤 → @ai 步骤（执行时走 Midscene）。
 * 登录阶段不录制（执行时由登录方式独立完成，登录凭据不进脚本）。
 */

const MAX_SELECTORS = 3;

/** Midscene YAML flow item 中的动作键（locate/value/cacheable 等为附属键） */
const ACTION_KEYS = new Set([
  'ai', 'aiAct', 'aiAction', 'aiTap', 'aiRightClick', 'aiDoubleClick', 'aiHover',
  'aiInput', 'aiClearInput', 'aiScroll', 'aiKeyboardPress', 'aiAssert', 'aiWaitFor',
  'aiQuery', 'Sleep', 'sleep', 'javascript', 'goto',
]);

export interface ScriptGenInput {
  executionId: string;
  caseId: string;
  caseName?: string;
  mode: 'NLP' | 'YAML';
  nlp?: string;
  yamlScript?: string;
  targetUrl?: string;
}

export class CodeRecorder {
  /**
   * 生成录制脚本；无法生成（无步骤/无缓存/解析失败）时返回 null，不影响执行主流程。
   */
  async generateScript(input: ScriptGenInput): Promise<string | null> {
    try {
      const { locateMap, planMap } = await this.loadCacheSources(input.caseId);
      const collector = takeDumpCollector(input.executionId);
      if (collector) {
        // 等待在途 DOM 反查探测完成（超时兜底），合并升级 selector（优先于缓存 xpath）
        await collector.settle();
        for (const [prompt, sels] of collector.snapshot()) {
          const old = locateMap.get(prompt) ?? [];
          const merged = [...sels, ...old.filter((s) => !sels.includes(s))];
          locateMap.set(prompt, merged);
        }
      }

      const steps = input.mode === 'YAML'
        ? this.stepsFromYaml(input.yamlScript)
        : this.stepsFromNlp(input.nlp, planMap);

      if (steps.length === 0) {
        logger.info({ caseId: input.caseId }, '录制器：无可录制步骤，跳过脚本生成');
        return null;
      }

      // Midscene plan 缓存的 aiInput 不携带 locate（语义：输入到上一步 aiTap 聚焦的元素），
      // 需与上一步配对继承 locate，否则空语义无法定位也无法兜底
      const pairedSteps = this.pairInputSteps(steps);

      // 合并"点击聚焦 + 输入"两步为单条 fill（fill 自带定位，无需前置 click），
      // 生成的代码与 Playwright codegen 的可读性对齐
      const mergedSteps = this.mergeClickFill(pairedSteps);

      const script = this.emit(input, mergedSteps, locateMap);
      const upgraded = Array.from(locateMap.values())
        .filter((sels) => sels.length > 0 && !sels[0].startsWith('xpath=')).length;
      logger.info({ caseId: input.caseId, executionId: input.executionId, steps: mergedSteps.length, upgradedSelectors: upgraded },
        '录制器：已生成 Playwright 脚本');
      return script;
    } catch (err) {
      logger.warn({ caseId: input.caseId, err }, '录制器：脚本生成失败（忽略，不影响执行结果）');
      return null;
    }
  }

  // ── 数据源加载 ─────────────────────────────────────────────

  private async loadCacheSources(caseId: string): Promise<{
    locateMap: Map<string, string[]>;
    planMap: Map<string, Array<Record<string, unknown>>>;
  }> {
    const locateMap = new Map<string, string[]>();
    const planMap = new Map<string, Array<Record<string, unknown>>>();
    const cacheFile = path.resolve('midscene_run/cache', `${caseId}.cache.yaml`);
    const raw = await fs.readFile(cacheFile, 'utf8').catch(() => null);
    if (!raw) return { locateMap, planMap };

    const doc = yaml.load(raw) as Record<string, any> | null;
    for (const entry of doc?.caches ?? []) {
      if (!entry || typeof entry !== 'object') continue;
      if (entry.type === 'locate') {
        const prompt = String(entry.prompt ?? '').trim();
        if (!prompt) continue;
        // 新格式 cache.xpaths；旧格式顶层 xpaths（已废弃但兼容）
        const xpaths: unknown[] = entry.cache?.xpaths ?? entry.xpaths ?? [];
        for (const x of xpaths) {
          if (typeof x === 'string' && x.trim()) this.addCandidate(locateMap, prompt, `xpath=${x}`);
        }
      } else if (entry.type === 'plan') {
        const prompt = String(entry.prompt ?? '').trim();
        const flow = this.parseWorkflowFlow(entry.yamlWorkflow);
        if (prompt && flow.length) planMap.set(prompt, flow);
      }
    }
    return { locateMap, planMap };
  }

  /** 存入候选 selector（已是可直接传 page.locator 的最终形态：升级 selector 原样、xpath 带 xpath= 前缀） */
  private addCandidate(locateMap: Map<string, string[]>, prompt: string, sel: string): void {
    const list = locateMap.get(prompt) ?? [];
    if (!list.includes(sel)) list.push(sel);
    locateMap.set(prompt, list);
  }

  /** 解析 plan 缓存的 yamlWorkflow（YAML 字符串，tasks[].flow 结构） */
  private parseWorkflowFlow(yamlWorkflow: unknown): Array<Record<string, unknown>> {
    if (typeof yamlWorkflow !== 'string' || !yamlWorkflow.trim()) return [];
    try {
      const doc = yaml.load(yamlWorkflow) as Record<string, any> | null;
      const flow: Array<Record<string, unknown>> = [];
      for (const task of doc?.tasks ?? []) {
        if (Array.isArray(task?.flow)) flow.push(...task.flow);
      }
      return flow.filter((it) => it && typeof it === 'object');
    } catch {
      return [];
    }
  }

  // ── 步骤骨架构建 ───────────────────────────────────────────

  /** YAML 模式：解析下发执行机的 YAML tasks flow */
  private stepsFromYaml(yamlScript?: string): RecordableStep[] {
    if (!yamlScript?.trim()) return [];
    let doc: Record<string, any> | null;
    try {
      doc = yaml.load(yamlScript) as Record<string, any> | null;
    } catch {
      return [];
    }
    const steps: RecordableStep[] = [];
    for (const task of doc?.tasks ?? []) {
      for (const item of task?.flow ?? []) {
        const step = this.stepFromFlowItem(item);
        if (step) steps.push(step);
      }
    }
    return steps;
  }

  /** NLP 模式：逐行取 plan 缓存的规划步骤；未命中缓存/动态行 → @ai 步骤 */
  private stepsFromNlp(
    nlp: string | undefined,
    planMap: Map<string, Array<Record<string, unknown>>>,
  ): RecordableStep[] {
    if (!nlp?.trim()) return [];
    const steps: RecordableStep[] = [];
    const lines = nlp.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const rawLine of lines) {
      const dynamic = hasDynamicContent(rawLine);
      const line = stripDynamicTag(rawLine);

      // NLP 行级自定义文件步骤（与 yaml-runner tryCustomFileStep 的识别规则一致）
      const fileStep = this.nlpLineToFileStep(line, dynamic);
      if (fileStep) {
        steps.push(fileStep);
        continue;
      }

      if (dynamic) {
        steps.push({ action: 'ai', semantic: line, dynamic: true });
        continue;
      }

      const planned = planMap.get(line);
      if (planned?.length) {
        for (const item of planned) {
          const step = this.stepFromFlowItem(item);
          if (step) steps.push(step);
        }
      } else {
        steps.push({ action: 'ai', semantic: line });
      }
    }
    return steps;
  }

  /** NLP 行 → 自定义文件步骤（上传/下载/断言文件） */
  private nlpLineToFileStep(line: string, dynamic: boolean): RecordableStep | null {
    const uploadMatch = line.match(/上传文件[：:\s]+['"]?([^\s，,'"]+)['"]?/);
    if (uploadMatch) {
      return { action: 'uploadFile', semantic: line, file: uploadMatch[1], dynamic };
    }
    if (/^下载|点击下载|下载文件/.test(line)) {
      return { action: 'downloadFile', semantic: line, dynamic };
    }
    if (/(断言|验证).{0,8}文件/.test(line)) {
      return { action: 'assertFile', semantic: line, dynamic };
    }
    return null;
  }

  /** 单个 flow item → RecordableStep */
  private stepFromFlowItem(item: Record<string, any>): RecordableStep | null {
    if (!item || typeof item !== 'object') return null;

    // 自定义文件步骤
    if ('uploadFile' in item) {
      return { action: 'uploadFile', semantic: String(item.uploadFile ?? ''), file: String(item.file ?? '') };
    }
    if ('downloadFile' in item) {
      return { action: 'downloadFile', semantic: String(item.downloadFile ?? ''), file: item.file ? String(item.file) : undefined };
    }
    if ('assertFile' in item) {
      return {
        action: 'assertFile', semantic: String(item.assertFile ?? ''),
        file: item.file ? String(item.file) : undefined,
        value: item.contains ? String(item.contains) : undefined,
        comment: item.titleContains ? `文件名包含 ${item.titleContains}` : undefined,
      };
    }

    const actionKey = Object.keys(item).find((k) => ACTION_KEYS.has(k));
    if (!actionKey) return null;

    const instruction = item[actionKey] == null ? '' : String(item[actionKey]);
    const locate = typeof item.locate === 'string' && item.locate.trim() ? item.locate.trim() : undefined;
    const semantic = locate || instruction;

    switch (actionKey) {
      case 'aiTap':
        return { action: 'click', semantic, locate, comment: instruction !== semantic ? instruction : undefined };
      case 'aiDoubleClick':
        return { action: 'dblclick', semantic, locate, comment: instruction !== semantic ? instruction : undefined };
      case 'aiHover':
        return { action: 'hover', semantic, locate };
      case 'aiInput':
        return { action: 'fill', semantic, locate, value: item.value == null ? '' : String(item.value) };
      case 'aiClearInput':
        return { action: 'fill', semantic, locate, value: '', comment: '清空输入框' };
      case 'aiKeyboardPress':
        return { action: 'keyboard', semantic: `按键 ${item.keyName ?? ''}`, value: String(item.keyName ?? '') };
      case 'Sleep':
      case 'sleep':
        return { action: 'sleep', semantic: `等待 ${item.timeMs ?? 0}ms`, value: String(item.timeMs ?? 0) };
      case 'aiAssert':
        return { action: 'assert', semantic: instruction };
      case 'aiWaitFor':
        return { action: 'waitfor', semantic: instruction };
      case 'javascript':
        return { action: 'evaluate', semantic: instruction.slice(0, 60), value: instruction };
      case 'goto':
        return null; // 页面导航由 runner 的 targetUrl 统一处理（stp.goto）
      default:
        // ai / aiAct / aiAction / aiRightClick / aiScroll / aiQuery 等 → @ai
        return { action: 'ai', semantic: instruction || locate || '' };
    }
  }

  // ── 代码生成 ───────────────────────────────────────────────

  /**
   * aiInput 配对：Midscene plan 缓存中输入步骤不携带 locate（承接上一步点击聚焦的元素），
   * 此处继承上一步的 locate 作为定位与兜底语义；无上文定位时由 emit 降级为 keyboard.type。
   */
  private pairInputSteps(steps: RecordableStep[]): RecordableStep[] {
    let prevLocate: string | undefined;
    return steps.map((step) => {
      let s = step;
      if (s.action === 'fill' && !s.locate && !s.semantic) {
        if (prevLocate) {
          s = { ...s, locate: prevLocate, semantic: prevLocate, comment: '输入目标承接上一步点击的元素' };
        }
        // 无上文定位：保持空语义，emit 时降级为 page.keyboard.type
      }
      if (s.locate) prevLocate = s.locate;
      return s;
    });
  }

  /**
   * 合并"点击聚焦 + 输入"步骤对：click(x) 紧跟 fill 且 locate 相同 → 合并为单条 fill
   * （fill 本身就先定位元素再输入，无需前置 click），生成代码与 codegen 的
   * fill 形态对齐，行数与可读性显著改善。
   */
  private mergeClickFill(steps: RecordableStep[]): RecordableStep[] {
    const out: RecordableStep[] = [];
    for (const step of steps) {
      const prev = out[out.length - 1];
      if (
        step.action === 'fill'
        && step.locate
        && prev
        && prev.action === 'click'
        && prev.locate === step.locate
      ) {
        // 吸收前一步 click（保留其原始指令注释），fill 定位能力覆盖聚焦
        out[out.length - 1] = { ...step, comment: prev.comment ?? step.comment };
        continue;
      }
      out.push(step);
    }
    return out;
  }

  private emit(input: ScriptGenInput, steps: RecordableStep[], locateMap: Map<string, string[]>): string {
    const q = (s: string) => JSON.stringify(String(s ?? ''));
    const lines: string[] = [];

    lines.push('// STP 自动录制脚本（由 Midscene 执行过程翻译生成，可直接切 CODE 模式重放）');
    lines.push(`// 用例: ${input.caseName || input.caseId}  |  源执行: ${input.executionId}  |  录制时间: ${new Date().toISOString()}`);
    lines.push('// 说明：登录阶段不录制（执行时由用例绑定的登录方式完成，本脚本不含登录凭据）；');
    lines.push('//       stp 上下文由执行机注入——元素定位失败时以本步骤语义为 prompt 由 Midscene AI 兜底。');
    lines.push('async function run(stp) {');
    lines.push('  const page = stp.page;');

    if (input.targetUrl) {
      lines.push(`  await stp.goto(page, ${q(input.targetUrl)}); // 打开业务目标页（已处于该页时自动跳过）`);
    }

    for (const step of steps) {
      // 无定位也无语义的步骤（fill 除外，其可降级为 keyboard.type）无法翻译，跳过并留注释
      if (!step.semantic && step.action !== 'fill') {
        lines.push('  // [跳过] 该步骤无定位与语义信息，无法翻译（原执行中可能为空动作）');
        continue;
      }
      lines.push(...this.emitStep(step, locateMap, q));
    }

    lines.push('}');
    return lines.join('\n');
  }

  private emitStep(step: RecordableStep, locateMap: Map<string, string[]>, q: (s: string) => string): string[] {
    const sels = this.selectorsFor(step.locate, locateMap);
    const selArg = `[${sels.map(q).join(', ')}]`;
    const comment = step.comment ? ` // ${step.comment}` : '';

    switch (step.action) {
      case 'click':
        return [`  await stp.click(page, ${selArg}, ${q(step.semantic)});${comment}`];
      case 'dblclick':
        return [`  await stp.dblclick(page, ${selArg}, ${q(step.semantic)});${comment}`];
      case 'hover':
        return [`  await stp.hover(page, ${selArg}, ${q(step.semantic)});${comment}`];
      case 'fill':
        if (!step.semantic) {
          // 无定位语义（且无上文可配对）：承接上一步聚焦的元素，直接键入
          return [`  await page.keyboard.type(${q(step.value ?? '')}); // 键入内容（承接上一步聚焦的输入框）`];
        }
        return [`  await stp.fill(page, ${selArg}, ${q(step.semantic)}, ${q(step.value ?? '')});${comment}`];
      case 'keyboard':
        return [`  await stp.keyboard(page, ${q(step.value ?? '')}, ${q(step.semantic)});`];
      case 'sleep': {
        const ms = Number(step.value);
        if (Number.isFinite(ms) && ms > 0) {
          return [`  await page.waitForTimeout(${ms}); // ${step.semantic}`];
        }
        return [`  await stp.ai(page, ${q(step.semantic)}); // @ai sleep 参数异常，走 Midscene`];
      }
      case 'assert':
        return [`  await stp.aiAssert(page, ${q(step.semantic)}); // @ai 语义断言，执行时走 Midscene`];
      case 'waitfor':
        return [`  await stp.aiWaitFor(page, ${q(step.semantic)}); // @ai 等待条件，执行时走 Midscene`];
      case 'ai':
        return [
          `  await stp.ai(page, ${q(step.semantic)});${step.dynamic ? ' // @ai 动态步骤（值不固化，执行时由 Midscene 现场识别）' : ' // @ai 步骤，执行时走 Midscene'}`,
        ];
      case 'uploadFile':
        return [`  await stp.upload(page, ${selArg}, ${q(step.semantic)}, ${q(step.file ?? '')});${comment}`];
      case 'downloadFile':
        return [
          `  await stp.download(page, ${selArg}, ${q(step.semantic)}${step.file ? `, ${q(step.file)}` : ''});${comment}`,
        ];
      case 'assertFile':
        return [
          `  await stp.assertFile(${q(step.semantic)}${step.file ? `, ${q(step.file)}` : ''}${step.value ? `, ${q(step.value)}` : ''}); // @ai 文件断言（执行机解析目标文件与断言内容）`,
        ];
      case 'evaluate':
        return [`  await stp.evaluate(page, ${JSON.stringify(step.value ?? '')}, ${q(step.semantic)});`];
      default:
        return [`  await stp.ai(page, ${q(step.semantic)}); // @ai 未知动作类型，走 Midscene`];
    }
  }

  /**
   * locate 语义 → selector 链（优先级：DOM 反查升级 selector > 缓存 xpath 兜底；
   * 去重后最多保留 3 条候选，全部失败时由 Midscene AI 以语义兜底）
   */
  private selectorsFor(locate: string | undefined, locateMap: Map<string, string[]>): string[] {
    if (!locate) return [];
    return (locateMap.get(locate) ?? []).slice(0, MAX_SELECTORS);
  }
}
