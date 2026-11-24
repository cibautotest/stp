/**
 * STP 文件步骤支持（插件侧）
 * 1. 全局跟踪浏览器下载（chrome.downloads.onChanged），记录最近完成的文件路径
 * 2. window.__stpFileStepHandler：被 aiAct 守卫调用，处理"断言/验证文件"类指令
 *    —— 经 execute-service /local-file-text 读取执行机本地文件（含 docx/xlsx 文本提取），
 *       先用确定性包含检查，兜底走 agent.aiAssert 语义断言。
 */
(function () {
  'use strict';

  var EXEC_SERVICE = 'http://localhost:3001';
  var LAST_KEY = 'stp_last_download';

  // ─── 下载跟踪（全局，无需拦截下载指令：Midscene 点击后 Chrome 自动下载） ───
  if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.onChanged) {
    chrome.downloads.onChanged.addListener(function (delta) {
      if (!delta || !delta.state || delta.state.current !== 'complete') return;
      chrome.downloads.search({ id: delta.id }, function (items) {
        var item = items && items[0];
        if (!item || !item.filename) return;
        var rec = { filename: item.filename, when: Date.now() };
        try {
          chrome.storage.local.set({ [LAST_KEY]: rec });
          console.log('[STP-FILE] 下载完成已记录:', rec.filename);
        } catch (e) {}
      });
    });
  }

  function getLastDownload() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get([LAST_KEY], function (r) { resolve(r && r[LAST_KEY] ? r[LAST_KEY] : null); });
      } catch (e) { resolve(null); }
    });
  }

  async function readFileText(filePath) {
    var resp = await fetch(EXEC_SERVICE + '/local-file-text?path=' + encodeURIComponent(filePath));
    var data = await resp.json().catch(function () { return {}; });
    if (!resp.ok || !data.exists) {
      throw new Error('读取文件失败: ' + (data.message || ('HTTP ' + resp.status)) + '（路径: ' + filePath + '）');
    }
    return data;
  }

  /** 从指令中提取断言目标：引号内文本 / 数字 / “有xxx/包含xxx”片段 */
  function extractExpectation(instruction) {
    var m = instruction.match(/[“"'']([^“”"']+)["'”]/);
    if (m) return m[1];
    m = instruction.match(/(?:包含|含有|里有|中有|为有|存在)\s*([^\s，。,]+)/);
    if (m) return m[1];
    m = instruction.match(/(\d+(?:\.\d+)?)/);
    if (m) return m[1];
    return '';
  }

  /** 等待新下载完成（与 before 记录对比，文件名不同或时间更新即视为新下载） */
  function waitForNewDownload(before, timeoutMs) {
    return new Promise(function (resolve) {
      var deadline = Date.now() + timeoutMs;
      var timer = setInterval(function () {
        getLastDownload().then(function (cur) {
          if (cur && cur.filename && (!before || cur.filename !== before.filename || cur.when > before.when)) {
            clearInterval(timer);
            resolve(cur);
          } else if (Date.now() > deadline) {
            clearInterval(timer);
            resolve(null);
          }
        });
      }, 1000);
    });
  }

  /**
   * aiAct 守卫回调：处理“断言/验证 文件”类指令（含“点击下载，断言文件…”复合指令）
   * @param agent      midscene agent（兜底语义断言用）
   * @param instruction 用户指令原文
   * @param origAiAct  原始 aiAct 引用（复合指令中用于执行下载动作）
   */
  window.__stpFileStepHandler = async function (agent, instruction, origAiAct) {
    var last = null;

    if (/下载/.test(instruction)) {
      // 复合指令：先执行下载部分（非断言片段逐个交给原始 aiAct），再等新下载完成
      console.log('[STP-FILE] 复合指令：先执行下载部分');
      var before = await getLastDownload();
      var segs = instruction.split(/[，。；\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var downloadSegs = segs.filter(function (s) { return !/(断言|验证)/.test(s); });
      for (var i = 0; i < downloadSegs.length; i++) {
        await origAiAct(downloadSegs[i]);
      }
      console.log('[STP-FILE] 下载动作已执行，等待新文件下载完成...');
      last = await waitForNewDownload(before, 60000);
      if (!last) {
        throw new Error('下载动作已执行，但 60 秒内未检测到新文件下载完成（可能点击的不是有效下载链接）');
      }
    } else {
      last = await getLastDownload();
    }

    if (!last || !last.filename) {
      throw new Error('断言文件失败：未检测到本次会话有任何已完成的下载，请先执行下载操作');
    }
    var data = await readFileText(last.filename);
    var expect = extractExpectation(instruction);

    console.log('[STP-FILE] 断言文件:', data.fileName, '| 大小:', data.size, '| 期望包含:', expect || '(语义断言)');

    if (expect) {
      // 确定性包含检查（优先，避免语义歧义）
      if (!data.text.includes(expect)) {
        throw new Error(
          '断言失败：文件「' + data.fileName + '」内容不包含「' + expect + '」' +
          '（文件 ' + data.size + ' 字节' + (data.truncated ? '，内容已截断' : '') + '）'
        );
      }
      // 通过：用 aiAssert 走一遍报告展示（内容片段佐证）
      return await agent.aiAssert(
        '文件「' + data.fileName + '」的内容中包含「' + expect + '」。\n文件内容片段：\n' + data.text.slice(0, 2000)
      );
    }

    // 无明确目标：语义断言
    return await agent.aiAssert(
      '以下文件(' + data.fileName + ')的内容满足描述「' + instruction + '」。\n文件内容：\n' + data.text.slice(0, 4000)
    );
  };

  console.log('[STP-FILE] 文件步骤支持已加载（下载跟踪 + 文件断言）');
})();
