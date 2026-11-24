import type { Page } from 'playwright';
import { logger } from '../utils/logger.js';

/**
 * 浏览器内 selector 探测函数（经 page.evaluate 注入执行，不可引用外部作用域）。
 * 反查入口（与 Midscene hitBy 三种形态对应）：
 *   1. 指定 xpath（'User expected path' 命中）→ document.evaluate 反查；
 *   2. AI 视觉命中（'Plan'，hitBy 只有 locatedPixelBbox、无 xpath）→ 以输出元素
 *      center 坐标 elementFromPoint 反查（截图推导坐标即视口坐标；失败再按页面坐标滚动补偿重试）。
 * 命中后按 Playwright codegen 同款优先级生成可读性/稳定性更高的 selector：
 *   data-testid > id > role+name > placeholder > 短文本
 * 无法命中返回 null，调用方降级用缓存 xpath 兜底。
 */
function probeSelectors(input: { xpath?: string; cx?: number; cy?: number }): string[] | null {
  const doc: any = (globalThis as any).document;
  if (!doc) return null;
  let el: any = null;
  if (input && typeof input.xpath === 'string' && input.xpath.trim()) {
    try {
      el = doc.evaluate(input.xpath, doc, null, 9 /* FIRST_ORDERED_NODE_TYPE */, null).singleNodeValue;
    } catch {
      el = null;
    }
  }
  if (!el && typeof input.cx === 'number' && typeof input.cy === 'number') {
    el = doc.elementFromPoint(input.cx, input.cy);
    if (!el) {
      // 坐标可能为页面绝对坐标（含滚动偏移）→ 换算为视口坐标重试
      const w: any = globalThis as any;
      if (typeof w.scrollX === 'number') {
        el = doc.elementFromPoint(input.cx - w.scrollX, input.cy - w.scrollY);
      }
    }
  }
  if (!el) return null;

  const roleOf = (node: any): string | null => {
    const explicit = node.getAttribute && node.getAttribute('role');
    if (explicit && explicit.trim()) return explicit.trim().split(/\s+/)[0];
    const tag = String(node.tagName || '').toLowerCase();
    const type = String((node.getAttribute && node.getAttribute('type')) || '').toLowerCase();
    switch (tag) {
      case 'button': return 'button';
      case 'a': return node.getAttribute && node.getAttribute('href') != null ? 'link' : null;
      case 'select': return 'combobox';
      case 'textarea': return 'textbox';
      case 'input':
        if (['text', 'search', 'email', 'url', 'tel', 'password', 'number'].indexOf(type) >= 0) return 'textbox';
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
        if (['button', 'submit', 'reset', 'image'].indexOf(type) >= 0) return 'button';
        return null;
      case 'li': return 'listitem';
      case 'img': return 'img';
      case 'nav': return 'navigation';
      default: return null;
    }
  };

  const nameOf = (node: any): string | null => {
    const aria = node.getAttribute && node.getAttribute('aria-label');
    if (aria && aria.trim()) return aria.trim();
    const labelledby = node.getAttribute && node.getAttribute('aria-labelledby');
    if (labelledby && labelledby.trim()) {
      const lab = doc.getElementById(labelledby.trim());
      const t = lab ? lab.textContent : null;
      if (t && t.trim()) return String(t).replace(/\s+/g, ' ').trim();
    }
    const id = node.id;
    if (id) {
      const lab = doc.querySelector('label[for="' + String(id).replace(/"/g, '\\"') + '"]');
      const t = lab ? lab.textContent : null;
      if (t && t.trim()) return String(t).replace(/\s+/g, ' ').trim();
    }
    const wrap = node.closest ? node.closest('label') : null;
    if (wrap && wrap !== node) {
      const t = wrap.textContent;
      if (t && t.trim()) return String(t).replace(/\s+/g, ' ').trim();
    }
    const text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && text.length <= 40) return text;
    const ph = node.getAttribute && node.getAttribute('placeholder');
    if (ph && ph.trim()) return ph.trim();
    return null;
  };

  const out: string[] = [];
  const push = (sel: string) => { if (sel && out.indexOf(sel) < 0) out.push(sel); };

  const testid = el.getAttribute ? (el.getAttribute('data-testid') || el.getAttribute('data-test')) : null;
  if (testid && testid.trim()) push('[data-testid=' + JSON.stringify(testid.trim()) + ']');
  const id = el.id;
  // 动态/自动生成 id 黑名单：每次加载都变（如 Element Plus 的 el-id-{ns}-{n}），
  // 用于定位必然失败、且计数复用时可能命中错误元素——比 xpath 兜底更不可靠，直接排除
  const DYNAMIC_ID_RE = /^(:[rR]|el-id-|radix-|headlessui[-:]|mui-|Mui|floating-|svelte-|astro-|ember\d)/;
  if (id && !DYNAMIC_ID_RE.test(String(id)) && /^[A-Za-z][A-Za-z0-9_-]*$/.test(String(id))) push('#' + id);
  const role = roleOf(el);
  const name = nameOf(el);
  if (role && name) push('role=' + role + '[name=' + JSON.stringify(name) + ']');
  const ph = el.getAttribute ? el.getAttribute('placeholder') : null;
  if (ph && ph.trim()) push('[placeholder=' + JSON.stringify(ph.trim()) + ']');
  const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  if (text && text.length <= 20) push('text=' + JSON.stringify(text));
  return out.length > 0 ? out : null;
}

/**
 * onDumpUpdate 录制事件收集器 + selector 升级探测器
 *
 * 挂在业务阶段 PlaywrightAgent 上，执行期间每步快照回调一次：
 *   1. 从 ExecutionDump 的 Locate 任务提取 prompt → 命中 xpath（兜底定位）；
 *   2. 关键增强：回调时机 = 每步执行后、下一步开始前——页面仍是该步后的状态，
 *      异步以命中 xpath 反查真实 DOM 元素，生成升级 selector（role/name/text 等
 *      语义定位，优先于绝对 xpath），可读性与抗改版能力对齐 Playwright codegen。
 */
export class DumpCollector {
  /** prompt → selector 候选链（升级 selector 在前，xpath= 兜底在后，均为可直接传 page.locator 的形态） */
  private candidates = new Map<string, string[]>();
  private inflight: Array<Promise<unknown>> = [];

  constructor(private readonly page?: Page) {}

  /** 挂给 agent.addDumpUpdateListener 的回调（防御式解析，任何异常都不影响执行） */
  readonly listener = (dump: string, executionDump?: unknown): void => {
    try {
      this.collect(executionDump);
    } catch (err) {
      logger.debug({ err }, 'DumpCollector 解析 dump 失败（忽略）');
    }
  };

  private collect(executionDump?: unknown): void {
    if (!executionDump || typeof executionDump !== 'object') return;
    const anyDump = executionDump as Record<string, unknown>;
    const executions = Array.isArray(anyDump.executions)
      ? (anyDump.executions as unknown[])
      : [executionDump];
    for (const ex of executions) {
      if (!ex || typeof ex !== 'object') continue;
      const tasks = (ex as Record<string, unknown>).tasks;
      if (!Array.isArray(tasks)) continue;
      for (const task of tasks) {
        if (!task || typeof task !== 'object') continue;
        const t = task as Record<string, any>;
        if (t.subType !== 'Locate') continue;
        const prompt = t.param?.prompt ?? t.param?.locate;
        if (typeof prompt !== 'string' || !prompt.trim()) continue;

        // 定位反查入口（与 Midscene hitBy 形态对应）：
        //   1. hitBy.context.xpath（'User expected path' 指定 xpath 命中）
        //   2. hitBy.context.cacheEntry 的缓存 xpaths（'Cache' 命中，与缓存文件同源）
        //   3. output.element 坐标（'Plan' AI 视觉直接命中——hitBy 只有 locatedPixelBbox，无 xpath）
        const hitContext = t.hitBy?.context;
        let xpath: string | undefined = hitContext?.xpath;
        if (!xpath) {
          const xps = hitContext?.cacheEntry?.cache?.xpaths ?? hitContext?.cacheEntry?.xpaths;
          if (Array.isArray(xps) && typeof xps[0] === 'string' && xps[0].trim()) xpath = xps[0];
        }
        let cx: number | undefined;
        let cy: number | undefined;
        const center = t.output?.element?.center;
        if (center && typeof center.x === 'number' && typeof center.y === 'number') {
          cx = center.x;
          cy = center.y;
        } else {
          const rect = t.output?.element?.rect ?? hitContext?.locatedPixelBbox;
          if (Array.isArray(rect) && rect.length >= 4
            && typeof rect[0] === 'number' && typeof rect[2] === 'number') {
            cx = rect[0] + rect[2] / 2;
            cy = rect[1] + rect[3] / 2;
          } else if (rect && typeof rect.x === 'number' && typeof rect.width === 'number') {
            cx = rect.x + rect.width / 2;
            cy = rect.y + (typeof rect.height === 'number' ? rect.height : 0) / 2;
          }
        }

        const key = prompt.trim();
        if (typeof xpath === 'string' && xpath.trim()) {
          this.add(key, `xpath=${xpath}`);
          void this.probe(key, { xpath });
        } else if (cx != null && cy != null) {
          void this.probe(key, { cx, cy });
        }
        // 两者皆无（异常 dump）→ 跳过，缓存文件兜底
      }
    }
  }

  private add(prompt: string, sel: string): void {
    const list = this.candidates.get(prompt) ?? [];
    if (!list.includes(sel)) list.push(sel);
    this.candidates.set(prompt, list);
  }

  /** 异步 DOM 反查升级 selector；失败（页面跳转/上下文销毁）静默降级 xpath 兜底 */
  private async probe(prompt: string, input: { xpath?: string; cx?: number; cy?: number }): Promise<void> {
    if (!this.page) return;
    const existing = this.candidates.get(prompt) ?? [];
    if (existing.some((s) => !s.startsWith('xpath='))) return; // 已有升级 selector，跳过
    const task = (async () => {
      try {
        const sels = await this.page!.evaluate(probeSelectors, input) as string[] | null;
        if (sels && sels.length) {
          const fallback = (this.candidates.get(prompt) ?? []).filter((s) => s.startsWith('xpath='));
          const merged = [...sels, ...fallback];
          const seen = new Set<string>();
          this.candidates.set(prompt, merged.filter((s) => (seen.has(s) ? false : seen.add(s))));
          logger.debug({ prompt, selectors: sels.length }, 'DumpCollector 升级 selector 探测成功');
        } else {
          logger.debug({ prompt }, 'DumpCollector 探测未命中（页面状态已变化或元素不可见），降级 xpath 兜底');
        }
      } catch {
        // 页面已跳转 / 执行上下文失效 → 保留 xpath 兜底
      }
    })();
    this.inflight.push(task);
    if (this.inflight.length > 64) this.inflight = this.inflight.slice(-32);
  }

  /** 等待在途探测完成（带超时兜底），录制器生成脚本前调用 */
  async settle(timeoutMs = 3000): Promise<void> {
    await Promise.race([
      Promise.allSettled(this.inflight).then(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  snapshot(): Array<[string, string[]]> {
    return Array.from(this.candidates.entries());
  }
}

// ── 执行级收集器注册表（runner 挂载 → worker 收尾时由录制器取走） ──

const collectors = new Map<string, DumpCollector>();

export function registerCollector(executionId: string, collector: DumpCollector): void {
  collectors.set(executionId, collector);
}

/** 取走并移除（录制器在生成脚本时调用：先等待在途探测，再合并进 selector 数据源） */
export function takeDumpCollector(executionId: string): DumpCollector | undefined {
  const c = collectors.get(executionId);
  collectors.delete(executionId);
  return c;
}

/** 释放（执行失败/取消时防泄漏） */
export function releaseCollector(executionId: string): void {
  collectors.delete(executionId);
}
