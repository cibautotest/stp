/**
 * 动态内容检测（yaml-runner 与录制器共用）
 *
 * 显式标签（【动态】/[动态]）或动态关键词（验证码/滑块/点选/随机数/当前日期等）。
 * 命中即禁用 plan 缓存——plan 缓存固化的是 AI 规划时识别的具体值
 * （如验证码文本 "Na 47Jg"），重放必然过期；录制器同样据此把动态步骤
 * 翻译为 @ai 步骤（值不固化为字面量，执行时由 Midscene 现场决策）。
 */

export const DYNAMIC_TAG_RE = /[【\[]动态[】\]]/;

/** 剥离动态标签（标签只用于缓存判定，不能发给 AI——否则会被当成内容的一部分） */
export function stripDynamicTag(text: string): string {
  return text.replace(/[【\[]动态[】\]]\s*/g, '').trim();
}

const DYNAMIC_KEYWORD = new RegExp(
  '验证码|captcha|滑块|滑动验证|点选|图形码|' +
  '短信.{0,4}(码|验证)|邮箱.{0,4}(码|验证)|邮件.{0,4}(码|验证)|' +
  '动态(密码|口令|值)|一次性(密码|口令|验证)|' +
  '随机(数|码|值)|验证字符|' +
  '当前日期|今天日期|当日日期|当前时间|时间戳|uuid',
  'i',
);

export function hasDynamicContent(text: string): boolean {
  if (!text) return false;
  if (DYNAMIC_TAG_RE.test(text)) return true;
  return DYNAMIC_KEYWORD.test(text.replace(/\s+/g, ''));
}
