// ── 录制步骤模型（Midscene 逻辑步骤 → Playwright 代码翻译的中间表示） ──

export type RecordedAction =
  | 'goto'        // 页导航（runner 注入 targetUrl 统一处理）
  | 'click'       // aiTap → locator.click
  | 'dblclick'    // aiDoubleClick → locator.dblclick
  | 'hover'       // aiHover → locator.hover
  | 'fill'        // aiInput/aiClearInput → locator.fill
  | 'keyboard'    // aiKeyboardPress → keyboard.press
  | 'sleep'       // Sleep → waitForTimeout
  | 'assert'      // aiAssert → @ai（语义断言，执行时走 Midscene）
  | 'waitfor'     // aiWaitFor → @ai
  | 'ai'          // ai/aiAct/aiScroll/aiQuery/动态步骤 → @ai
  | 'uploadFile'  // 自定义上传步骤
  | 'downloadFile'// 自定义下载步骤
  | 'assertFile'  // 自定义文件断言步骤
  | 'evaluate';   // javascript → page.evaluate

export interface RecordableStep {
  action: RecordedAction;
  /** 语义注释（= AI 兜底时的 prompt，也是 locate 描述） */
  semantic: string;
  /** locate 描述（用于匹配 locate 缓存 xpaths） */
  locate?: string;
  /** 输入值 / sleep 毫秒 / 按键名 / javascript 代码 */
  value?: string;
  /** 上传/下载/断言的文件路径 */
  file?: string;
  /** 原始指令（与 semantic 不同时作为行内注释保留） */
  comment?: string;
  /** 动态步骤（验证码/日期/随机值）→ 强制 @ai，值不固化 */
  dynamic?: boolean;
}
