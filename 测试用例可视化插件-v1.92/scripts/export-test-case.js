/**
 * export-test-case.js — 用例导出模块（测试用例可视化插件 v1.92）
 *
 * 核心流程（三阶段状态机）：
 *   UNAUTHENTICATED（登录遮罩）→ PROJECT_SELECT（项目选择/创建）→ READY（就绪）
 *
 * 步骤日志系统（关键）：
 *   官方 Playground 单轮清除对话历史（DOM 中永远只有最新一条指令），
 *   因此导出步骤不再依赖 DOM，而是插件自维护持久化日志：
 *   - 新指令出现 → 记录 { text, status: 'running' }（按页面 URL 分组，localStorage）
 *   - antd 通知含 "Execution failed" → 最新 running 标 failure
 *   - 新指令到来 / 文本稳定 3s → 关键词判定上一轮的 success/failure
 *
 * 导出默认勾选规则：
 *   - failure：红色 ✗，默认不选
 *   - 已生成过用例：黄色徽章"已生成: 用例名"，默认不选（按项目维度记录）
 *   - running（未确认）：蓝色 ⏳，默认选
 *   - 其余：默认选
 *
 * 项目目录（平台层级：项目-目录-用例）：
 *   导出弹窗必选目录，数据与平台同步，支持创建目录，按项目记忆上次选择。
 *
 * 一键同步平台（一步式接口）：
 *   POST /api/platform/execute/create-and-execute  Body: { projectId, directoryId, name, nlp }
 *
 * 随机数按钮：
 *   指定位数生成随机数 → 自动插入聊天输入框（触发 React input 事件）
 */
(function () {
  'use strict';

  // ─── State machine ─────────────────────────────────────────
  var STATE = {
    UNAUTHENTICATED: 'unauthenticated',
    PROJECT_SELECT:  'project_select',
    READY:           'ready'
  };
  var _state = STATE.UNAUTHENTICATED;
  var _authToken = null;
  var _currentUser = null;

  // ═══════════════════════════════════════════════════════════
  //  步骤日志系统（按项目维度分组持久化）
  //  结构: { "<projectId>": [ { text, status: 'running'|'success'|'failure', ts } ] }
  // ═══════════════════════════════════════════════════════════
  var STEP_LOG_KEY = 'midscene_step_log';

  function normalizeStepText(t) {
    return (t || '').replace(/\s+/g, ' ').trim();
  }

  // 去冒号前缀后规范化（与已生成指纹的文本格式对齐）
  function normalizeForCompare(t) {
    var raw = (t || '').trim();
    var colonIndex = raw.indexOf(':');
    if (colonIndex >= 0) raw = raw.substring(colonIndex + 1).trim();
    return raw.replace(/\s+/g, ' ').trim();
  }

  function readStepLogAll() {
    try { return JSON.parse(localStorage.getItem(STEP_LOG_KEY) || '{}'); } catch (e) { return {}; }
  }

  function writeStepLogAll(all) {
    try { localStorage.setItem(STEP_LOG_KEY, JSON.stringify(all)); } catch (e) {}
  }

  function getStepLog(projectId) {
    if (!projectId) return [];
    var all = readStepLogAll();
    return all[projectId] || [];
  }

  function appendStepLog(projectId, entry) {
    if (!projectId) return;
    var all = readStepLogAll();
    var list = all[projectId] || [];
    list.push(entry);
    all[projectId] = list;
    writeStepLogAll(all);
  }

  function updateLatestRunningStatus(projectId, status) {
    if (!projectId) return;
    var all = readStepLogAll();
    var list = all[projectId] || [];
    for (var i = list.length - 1; i >= 0; i--) {
      if (list[i].status === 'running') {
        list[i].status = status;
        writeStepLogAll(all);
        return;
      }
    }
  }

  function clearStepLog(projectId) {
    if (!projectId) return;
    var all = readStepLogAll();
    delete all[projectId];
    writeStepLogAll(all);
  }

  // ─── 当前页面 URL 跟踪 ─────────────────────────────────────
  var _currentPageUrl = '';

  function refreshPageUrl(callback) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.log('[STP-DIAG] refreshPageUrl lastError:', chrome.runtime.lastError.message);
        }
        var url = (tabs && tabs[0] && tabs[0].url && tabs[0].url.indexOf('chrome://') !== 0)
            ? tabs[0].url : '';
        _currentPageUrl = url;
        console.log('[STP-DIAG] refreshPageUrl ->', JSON.stringify(url), 'tabs:', tabs ? tabs.length : 'null');
        if (callback) callback(url);
      });
    } catch (e) {
      console.log('[STP-DIAG] refreshPageUrl EXCEPTION:', e.message);
      if (callback) callback(_currentPageUrl);
    }
  }

  // ─── 已生成步骤指纹（按项目维度） ─────────────────────────
  // 存储结构: { "<projectId>": [ { text: "<规范化文本>", cases: [{ name, id, ts }] } ] }
  var EXPORTED_KEY = 'midscene_exported_steps';

  function getExportedSteps(projectId) {
    try {
      var all = JSON.parse(localStorage.getItem(EXPORTED_KEY) || '{}');
      return all[projectId] || [];
    } catch (e) { return []; }
  }

  function recordExportedSteps(projectId, stepTexts, caseName, caseId) {
    if (!projectId || !stepTexts || stepTexts.length === 0) return;
    try {
      var all = JSON.parse(localStorage.getItem(EXPORTED_KEY) || '{}');
      var list = all[projectId] || [];
      stepTexts.forEach(function (s) {
        var norm = normalizeForCompare(s);
        var hit = list.find(function (e) { return e.text === norm; });
        if (hit) {
          hit.cases.push({ name: caseName, id: caseId, ts: Date.now() });
        } else {
          list.push({ text: norm, cases: [{ name: caseName, id: caseId, ts: Date.now() }] });
        }
      });
      all[projectId] = list;
      localStorage.setItem(EXPORTED_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  function getCurrentProjectId() {
    try { return localStorage.getItem('midscene_project_id') || ''; } catch (e) { return ''; }
  }

  // ─── 目录选择记忆（按项目维度） ────────────────────────────
  function getRememberedDirectoryId(projectId) {
    try { return localStorage.getItem('midscene_directory_id_' + projectId) || ''; } catch (e) { return ''; }
  }

  function rememberDirectoryId(projectId, directoryId) {
    try { localStorage.setItem('midscene_directory_id_' + projectId, directoryId); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  //  执行结果监听（信号 A/B/C）
  // ═══════════════════════════════════════════════════════════
  var _lastSeenBubbleText = '';
  var _settleTimer = null;

  // 收集 bubble 之后的 assistant 响应区段文本（限定 #root 内）
  function collectAssistantText(bubble) {
    var texts = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var pastStart = false;
    var charCount = 0;
    var node;
    while ((node = walker.nextNode())) {
      if (!pastStart) {
        if (bubble.contains(node)) pastStart = true;
        continue;
      }
      // 遇到下一个 user-message-bubble 停止
      var p = node.parentElement;
      while (p) {
        if (p !== bubble && p.classList && p.classList.contains('user-message-bubble')) {
          return texts.join('');
        }
        p = p.parentElement;
      }
      // 只统计 #root 内文本，避免弹窗干扰
      var inRoot = false;
      p = node.parentElement;
      while (p) {
        if (p.id === 'root') { inRoot = true; break; }
        p = p.parentElement;
      }
      if (!inRoot) continue;
      texts.push(node.nodeValue);
      charCount += node.nodeValue.length;
      if (charCount > 4000) break;
    }
    return texts.join('');
  }

  // 判定执行结果：以 SDK 生成的 "Task failed: ..." 为唯一失败标志
  // （成功响应的描述性文本可能含 error/失败 等词，宽泛关键词会造成误判）
  function judgeByText(text) {
    if ((text || '').indexOf('Task failed') >= 0) {
      return 'failure';
    }
    return 'success';
  }

  // 判定最新一条 running 记录
  function settleLatestRunning() {
    var projectId = getCurrentProjectId();
    if (!projectId) return;
    var log = getStepLog(projectId);
    var latestRunning = null;
    for (var i = log.length - 1; i >= 0; i--) {
      if (log[i].status === 'running') { latestRunning = log[i]; break; }
    }
    if (!latestRunning) return;
    var bubbles = document.querySelectorAll('.user-message-bubble');
    if (bubbles.length === 0) {
      // DOM 已清除，无法判定 → 保留 running
      return;
    }
    var lastBubble = bubbles[bubbles.length - 1];
    var segment = collectAssistantText(lastBubble);
    // 区段需要有一定内容量才判定（避免执行刚开始时误判）
    if (segment.trim().length < 10) return;
    var verdict = judgeByText(segment);
    console.log('[STP-DIAG] settleLatestRunning 判定:', verdict, '| segment 前200字:', segment.slice(0, 200).replace(/\s+/g, ' '));
    updateLatestRunningStatus(projectId, verdict);
  }

  function scheduleSettle() {
    if (_settleTimer) clearTimeout(_settleTimer);
    _settleTimer = setTimeout(settleLatestRunning, 3000);
  }

  // 信号 A：检测新指令出现
  function detectNewInstruction() {
    var bubbles = document.querySelectorAll('.user-message-bubble');
    if (bubbles.length === 0) return;
    var lastBubble = bubbles[bubbles.length - 1];
    var text = (lastBubble.textContent || '').trim();
    if (!text || text === _lastSeenBubbleText) return;

    console.log('[STP-DIAG] 检测到新指令:', text.slice(0, 50), '| bubbles:', bubbles.length);

    // 新指令到来：先结算上一轮 running
    if (_lastSeenBubbleText) {
      settleLatestRunning();
    }
    _lastSeenBubbleText = text;

    // 记录新一轮 running（按当前项目维度）
    var projectId = getCurrentProjectId();
    if (!projectId) {
      console.log('[STP-DIAG] appendStepLog 跳过：未选择项目');
      return;
    }
    appendStepLog(projectId, { text: text, status: 'running', ts: Date.now() });
    console.log('[STP-DIAG] appendStepLog 已写入 projectId:', projectId);
  }

  // 信号 B：检测失败通知（antd notification / message / 任意新增文本）
  function detectFailureNotification() {
    var projectId = getCurrentProjectId();
    if (!projectId) return;
    var candidates = document.querySelectorAll(
      '.ant-notification-notice, .ant-message-notice, [class*="notification"], [class*="toast"], [class*="message"], [role="alert"]'
    );
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.dataset && el.dataset.midsceneFailHandled === '1') continue;
      var text = el.textContent || '';
      if (text.indexOf('Execution failed') >= 0) {
        if (el.dataset) el.dataset.midsceneFailHandled = '1';
        console.log('[STP-DIAG] 捕获失败通知:', text.slice(0, 80).replace(/\s+/g, ' '));
        updateLatestRunningStatus(projectId, 'failure');
      }
    }
  }

  // 统一的 DOM 变化处理（在 MutationObserver 中调用）
  function onDomMutation() {
    detectNewInstruction();
    detectFailureNotification();
    scheduleSettle();
  }

  // ─── 标注已生成记录到步骤上 ────────────────────────────────
  // 匹配维度：弹窗当前选中的项目（用户实际要同步的目标项目），回退到当前项目
  function annotateExported(steps, projectId) {
    var pid = projectId || getCurrentProjectId();
    if (!pid || pid === '__CREATE_NEW__') return steps;
    var exported = getExportedSteps(pid);
    if (exported.length === 0) return steps;
    steps.forEach(function (s) {
      var norm = normalizeForCompare(s.text);
      var hit = exported.find(function (e) { return e.text === norm; });
      if (hit) s.exported = hit.cases;
      console.log('[STP-DIAG] annotate match:', hit ? 'HIT' : 'MISS', '| norm:', norm.slice(0, 60));
    });
    console.log('[STP-DIAG] annotateExported projectId:', pid, '指纹数:', exported.length);
    return steps;
  }

  // ─── Render the steps list into the modal ──────────────────
  function renderStepList(steps) {
    const container = document.getElementById('midscene-steps-container');
    const countEl = document.getElementById('midscene-step-count');
    if (!container) return;

    container.innerHTML = '';

    if (steps.length === 0) {
      container.innerHTML = '<div class="empty-msg" style="padding:20px 0;">当前页面还没有执行过指令，先在对话中输入并执行吧。</div>';
      if (countEl) countEl.textContent = '已选择 0 个步骤';
      return;
    }

    steps.forEach(function (step, i) {
      const item = document.createElement('div');
      item.className = 'midscene-step-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'midscene-step-checkbox';
      checkbox.dataset.index = i;

      var badgeClass = 'midscene-step-status';
      var badgeIcon = '';
      var exportedBadge = null;

      if (step.exported && step.exported.length > 0) {
        // 已生成过用例：默认不勾选 + 黄色徽章
        checkbox.checked = false;
        badgeClass += ' exported';
        badgeIcon = '↺';
        item.classList.add('exported');
        var names = step.exported.map(function (c) { return c.name; });
        exportedBadge = document.createElement('span');
        exportedBadge.className = 'midscene-step-exported-badge';
        exportedBadge.textContent = '已生成: ' + names[0] + (names.length > 1 ? ' +' + (names.length - 1) : '');
        exportedBadge.title = '该步骤已生成过用例：' + names.join('、');
      } else {
        if (step.status === 'failure') {
          checkbox.checked = false;
          badgeClass += ' failure';
          badgeIcon = '✗';
        } else if (step.status === 'running') {
          checkbox.checked = true;
          badgeClass += ' loading';
          badgeIcon = '⏳';
        } else {
          checkbox.checked = true;
          badgeClass += ' success';
          badgeIcon = '✓';
        }
      }

      const badge = document.createElement('span');
      badge.className = badgeClass;
      badge.textContent = badgeIcon;

      const textSpan = document.createElement('span');
      textSpan.className = 'midscene-step-text';
      textSpan.textContent = step.text;
      textSpan.dataset.fullText = step.text;

      item.appendChild(checkbox);
      item.appendChild(badge);
      item.appendChild(textSpan);
      if (exportedBadge) item.appendChild(exportedBadge);

      checkbox.addEventListener('change', function () {
        if (this.checked) {
          item.classList.add('checked');
          item.classList.remove('disabled');
        } else {
          item.classList.remove('checked');
          item.classList.add('disabled');
        }
        updateStepCount();
      });

      if (checkbox.checked) {
        item.classList.add('checked');
      } else {
        item.classList.add('disabled');
      }

      container.appendChild(item);
    });

    updateStepCount();
  }

  // ─── Update step count display ─────────────────────────────
  function updateStepCount() {
    const checkboxes = document.querySelectorAll('#midscene-steps-container .midscene-step-checkbox');
    const countEl = document.getElementById('midscene-step-count');
    if (!countEl) return;
    const checked = Array.from(checkboxes).filter(function (cb) { return cb.checked; }).length;
    countEl.textContent = '已选择 ' + checked + ' / ' + checkboxes.length + ' 个步骤';
  }

  // ─── Populate export modal project dropdown ────────────────
  function populateExportProjectDropdown() {
    var selectEl = document.getElementById('midscene-project-select');
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— 请选择项目 —</option>';

    try {
      var cached = localStorage.getItem('midscene_project_list');
      if (cached) {
        var projects = JSON.parse(cached);
        projects.forEach(function (p) {
          var opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.name;
          selectEl.appendChild(opt);
        });
      }
    } catch (e) {}

    var createOpt = document.createElement('option');
    createOpt.value = '__CREATE_NEW__';
    createOpt.textContent = '➕ 创建新项目…';
    selectEl.appendChild(createOpt);

    try {
      var currentId = localStorage.getItem('midscene_project_id');
      if (currentId) {
        selectEl.value = currentId;
      }
    } catch (e) {}

    var newGroup = document.getElementById('midscene-new-project-group');
    var newInput = document.getElementById('midscene-new-project-input');
    if (newInput) newInput.value = '';

    selectEl.onchange = function () {
      if (selectEl.value === '__CREATE_NEW__') {
        if (newGroup) {
          newGroup.style.display = 'block';
          if (newInput) newInput.focus();
        }
      } else {
        if (newGroup) newGroup.style.display = 'none';
        if (newInput) newInput.value = '';
      }
      // 项目切换 → 刷新目录下拉 + 按目标项目重新标注已生成步骤
      loadDirectoryDropdown(selectEl.value === '__CREATE_NEW__' ? '' : selectEl.value);
      renderStepsFromLog();
    };

    if (selectEl.value === '__CREATE_NEW__') {
      if (newGroup) newGroup.style.display = 'block';
    }

    // 弹窗打开时主动初始化目录下拉（程序赋值 select.value 不会触发 onchange）
    loadDirectoryDropdown(selectEl.value === '__CREATE_NEW__' ? '' : selectEl.value);
  }

  // ─── 目录下拉（加载 / 创建 / 记忆） ────────────────────────
  async function loadDirectoryDropdown(projectId) {
    var selectEl = document.getElementById('midscene-directory-select');
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— 请选择目录 —</option>';
    hideNewDirectoryGroup();

    if (!projectId) return;

    var result = await MidsceneAuth.getDirectories(_authToken, projectId);
    if (result.success) {
      result.directories.forEach(function (d) {
        var opt = document.createElement('option');
        opt.value = d.id;
        opt.textContent = d.name;
        selectEl.appendChild(opt);
      });
    }

    // 底部固定"创建目录"选项
    var createOpt = document.createElement('option');
    createOpt.value = '__CREATE_NEW_DIR__';
    createOpt.textContent = '➕ 创建目录…';
    selectEl.appendChild(createOpt);

    // 恢复上次选择
    var remembered = getRememberedDirectoryId(projectId);
    if (remembered && result.success &&
        result.directories.some(function (d) { return d.id === remembered; })) {
      selectEl.value = remembered;
    }

    selectEl.onchange = function () {
      if (selectEl.value === '__CREATE_NEW_DIR__') {
        showNewDirectoryGroup();
      } else {
        hideNewDirectoryGroup();
        if (selectEl.value) rememberDirectoryId(projectId, selectEl.value);
      }
    };

    // 若恢复的选择就是创建选项，展开输入
    if (selectEl.value === '__CREATE_NEW_DIR__') showNewDirectoryGroup();
  }

  function showNewDirectoryGroup() {
    var group = document.getElementById('midscene-new-directory-group');
    if (group) group.style.display = 'block';
    var input = document.getElementById('midscene-new-directory-input');
    if (input) { input.value = ''; input.focus(); }
  }

  function hideNewDirectoryGroup() {
    var group = document.getElementById('midscene-new-directory-group');
    if (group) group.style.display = 'none';
    var input = document.getElementById('midscene-new-directory-input');
    if (input) input.value = '';
  }

  // 确保目录就绪：若用户选择"创建目录"，先创建并返回新目录 ID
  async function ensureDirectoryId(projectId) {
    var selectEl = document.getElementById('midscene-directory-select');
    if (!selectEl) return { ok: false, error: '目录下拉不存在' };
    var val = selectEl.value;

    if (val === '__CREATE_NEW_DIR__') {
      var newName = document.getElementById('midscene-new-directory-input').value.trim();
      if (!newName) return { ok: false, error: '请输入新目录名称' };
      var result = await MidsceneAuth.createDirectory(_authToken, projectId, newName);
      if (!result.success) return { ok: false, error: result.error || '创建目录失败' };
      var newId = result.directory.id;
      rememberDirectoryId(projectId, newId);
      // 静默刷新目录下拉
      loadDirectoryDropdown(projectId);
      return { ok: true, directoryId: newId };
    }

    if (!val) return { ok: false, error: '请选择项目目录' };
    return { ok: true, directoryId: val };
  }

  // ─── Form persistence ──────────────────────────────────────
  var STORAGE_KEY = 'midscene_export_form';

  function saveFormValues() {
    var selectEl = document.getElementById('midscene-project-select');
    var data = {
      projectId: selectEl ? selectEl.value : '',
      testUrl: document.getElementById('midscene-test-url').value
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function loadFormValues(freshUrl) {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.testUrl) document.getElementById('midscene-test-url').value = data.testUrl;
      }
    } catch (e) {}
    var testUrlEl = document.getElementById('midscene-test-url');
    if (testUrlEl && freshUrl) {
      testUrlEl.value = freshUrl;
    }
  }

  // ─── UI: Show the modal ────────────────────────────────────
  function showModal(freshUrl) {
    populateExportProjectDropdown();
    const overlay = document.getElementById('midscene-modal-overlay');
    if (overlay) overlay.classList.add('active');
    loadFormValues(freshUrl);
    hideBanner();
    var caseNameInput = document.getElementById('midscene-case-name');
    if (caseNameInput) caseNameInput.value = '';
  }

  function hideModal() {
    const overlay = document.getElementById('midscene-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  // ─── Refresh current tab URL ───────────────────────────────
  function refreshCurrentUrl(callback) {
    refreshPageUrl(callback);
  }

  // ─── Main export handler ───────────────────────────────────
  function handleExport() {
    if (_state !== STATE.READY) {
      showAuthOverlay();
      return;
    }
    refreshCurrentUrl(function (url) {
      // 先打开弹窗（初始化项目下拉），再按弹窗选中项目渲染步骤列表
      showModal(url);
      renderStepsFromLog();
    });
  }

  // 从步骤日志渲染列表（按弹窗选中项目标注已生成指纹）
  function renderStepsFromLog() {
    var currentPid = getCurrentProjectId();
    var selectEl = document.getElementById('midscene-project-select');
    var selectedPid = selectEl && selectEl.value && selectEl.value !== '__CREATE_NEW__'
        ? selectEl.value : currentPid;
    var log = getStepLog(currentPid);
    console.log('[STP-DIAG] renderStepsFromLog 当前项目:', currentPid, '弹窗项目:', selectedPid, '日志条数:', log.length);
    var steps = annotateExported(log.map(function (e) {
      return { text: e.text, status: e.status, exported: null };
    }), selectedPid);
    renderStepList(steps);
  }

  // ─── 清空历史：删除该项目全部本地数据（步骤日志 + 已生成指纹） ──
  function handleClearHistory() {
    if (!confirm('确定清空当前项目的全部本地记录吗？\n（包含步骤日志与"已生成用例"标记，不影响平台上的用例数据）')) return;
    var projectId = getCurrentProjectId();
    // 清步骤日志
    clearStepLog(projectId);
    // 清已生成指纹
    try {
      var all = JSON.parse(localStorage.getItem(EXPORTED_KEY) || '{}');
      delete all[projectId];
      localStorage.setItem(EXPORTED_KEY, JSON.stringify(all));
    } catch (e) {}
    renderStepList([]);
  }

  // ─── Form validation ───────────────────────────────────────
  function validateForm() {
    var selectEl = document.getElementById('midscene-project-select');
    var projectValue = selectEl ? selectEl.value : '';
    var isNewProject = projectValue === '__CREATE_NEW__';
    var dirSelectEl = document.getElementById('midscene-directory-select');
    var dirValue = dirSelectEl ? dirSelectEl.value : '';
    var caseName = document.getElementById('midscene-case-name').value.trim();
    var testUrl = document.getElementById('midscene-test-url').value.trim();
    var checkboxes = document.querySelectorAll('#midscene-steps-container .midscene-step-checkbox');
    var checkedCount = Array.from(checkboxes).filter(function (cb) { return cb.checked; }).length;

    var errors = [];
    if (isNewProject) {
      var newName = document.getElementById('midscene-new-project-input').value.trim();
      if (!newName) errors.push('请输入新项目名称');
    } else if (!projectValue) {
      errors.push('请选择项目');
    }
    // 目录必选（新项目时目录在创建项目后再选，这里仅对已有项目校验）
    if (!isNewProject) {
      if (!dirValue) {
        errors.push('请选择项目目录');
      } else if (dirValue === '__CREATE_NEW_DIR__') {
        var newDirName = document.getElementById('midscene-new-directory-input').value.trim();
        if (!newDirName) errors.push('请输入新目录名称');
      }
    }
    if (!caseName) errors.push('请输入用例名称');
    if (!testUrl) errors.push('请输入测试网址');
    if (checkedCount === 0) errors.push('请至少选择一个测试步骤');

    return { valid: errors.length === 0, errors: errors };
  }

  // ─── Banner helpers ────────────────────────────────────────
  var _bannerTimer = null;

  function showBanner(msg, type) {
    var banner = document.getElementById('midscene-msg-banner');
    if (!banner) return;
    if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; }
    banner.classList.remove('hide', 'show');
    banner.style.display = '';
    banner.textContent = msg;
    banner.className = 'midscene-msg-banner ' + (type || 'error');
    void banner.offsetWidth;
    banner.classList.add('show');
    var body = document.getElementById('midscene-modal-body');
    if (body) body.scrollTop = 0;
    var duration = type === 'error' ? 8000 : 5000;
    _bannerTimer = setTimeout(function () { dismissBanner(banner); }, duration);
  }

  function dismissBanner(banner) {
    if (!banner) return;
    banner.classList.remove('show');
    banner.classList.add('hide');
    setTimeout(function () {
      banner.classList.remove('hide');
      banner.style.display = 'none';
    }, 300);
  }

  function hideBanner() {
    if (_bannerTimer) { clearTimeout(_bannerTimer); _bannerTimer = null; }
    var banner = document.getElementById('midscene-msg-banner');
    if (banner) {
      banner.classList.remove('show');
      banner.classList.add('hide');
      setTimeout(function () {
        banner.classList.remove('hide');
        banner.style.display = 'none';
      }, 300);
    }
  }

  function showValidationErrors(errors) {
    showBanner(errors.join('；'), 'error');
  }

  // ─── Platform API integration ──────────────────────────────
  var DEFAULT_PLATFORM_URL = 'http://10.3.71.299:8081';

  function getPlatformUrl() {
    try {
      return localStorage.getItem('midscene_platform_url') || DEFAULT_PLATFORM_URL;
    } catch (e) { return DEFAULT_PLATFORM_URL; }
  }

  function setBtnLoading(loading) {
    var btn = document.getElementById('midscene-modal-copy-btn');
    if (!btn) return;
    if (loading) {
      btn.disabled = true;
      btn._origText = btn.textContent;
      btn.textContent = '⏳ 正在生成...';
    } else {
      btn.disabled = false;
      if (btn._origText) {
        btn.textContent = btn._origText;
        delete btn._origText;
      }
    }
  }

  // 收集勾选步骤的原始文本（去冒号前缀）
  function collectCheckedStepTexts() {
    var checkboxes = document.querySelectorAll('#midscene-steps-container .midscene-step-checkbox');
    var stepActions = [];
    checkboxes.forEach(function (cb) {
      if (cb.checked) {
        var stepItem = cb.closest('.midscene-step-item');
        var textEl = stepItem ? stepItem.querySelector('.midscene-step-text') : null;
        if (textEl) {
          stepActions.push(normalizeForCompare(textEl.dataset.fullText || textEl.textContent));
        }
      }
    });
    return stepActions;
  }

  /**
   * 一键同步平台（一步式）：
   * 确保 projectId 与 directoryId 就绪（必要时创建），拼接 NLP 调用
   * POST /api/platform/execute/create-and-execute
   */
  async function sendToPlatform() {
    var selectEl = document.getElementById('midscene-project-select');
    var projectValue = selectEl ? selectEl.value : '';
    var isNewProject = projectValue === '__CREATE_NEW__';

    var caseName = document.getElementById('midscene-case-name').value.trim();
    var testUrl = document.getElementById('midscene-test-url').value.trim();
    var platformUrl = getPlatformUrl();
    var token = _authToken;

    if (!token) {
      return { success: false, error: '登录已过期，请刷新插件后重新登录' };
    }

    var stepActions = collectCheckedStepTexts();

    var nlpText = '打开' + testUrl;
    if (stepActions.length > 0) {
      nlpText += '，' + stepActions.join('，');
    }

    setBtnLoading(true);

    try {
      var projectId;

      if (isNewProject) {
        var newName = document.getElementById('midscene-new-project-input').value.trim();
        var createResult = await MidsceneAuth.createProject(token, newName);
        if (!createResult.success) {
          throw new Error(createResult.error || '创建项目失败');
        }
        projectId = createResult.project.id;
        var projectName = createResult.project.name;
        saveProjectToCache(projectId, projectName);
        try {
          var cachedList = JSON.parse(localStorage.getItem('midscene_project_list') || '[]');
          cachedList = cachedList.filter(function (p) { return p.id !== projectId; });
          cachedList.push({ id: projectId, name: projectName });
          localStorage.setItem('midscene_project_list', JSON.stringify(cachedList));
        } catch (e) {}
        populateExportProjectDropdown();
        // 新项目：重新加载目录下拉（新项目初始无目录，引导创建）
        loadDirectoryDropdown(projectId);
      } else {
        projectId = projectValue;
      }

      if (!projectId) {
        throw new Error('项目ID无效');
      }

      // 确保目录就绪（新项目场景：用户需在目录下拉选择"创建目录"）
      var dirResult = await ensureDirectoryId(projectId);
      if (!dirResult.ok) {
        throw new Error(dirResult.error);
      }
      var directoryId = dirResult.directoryId;

      var resp = await fetch(platformUrl + '/api/platform/execute/create-and-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          projectId: projectId,
          directoryId: directoryId,
          name: caseName,
          nlp: nlpText
        })
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          clearAuthData();
          hideModal();
          showAuthOverlay();
          throw new Error('登录已过期，请重新登录');
        }
        var errData = await resp.json().catch(function () { return {}; });
        throw new Error(errData.error || '创建测试用例失败');
      }

      var result = await resp.json();
      saveFormValues();

      // 记录已生成步骤指纹（无论执行是否成功，用例均已创建）
      recordExportedSteps(projectId, stepActions, caseName, result.caseId || '');
      markStepsAsExportedInModal(caseName, stepActions);

      if (result.success === false) {
        return {
          success: true,
          warning: true,
          caseName: caseName,
          message: '用例「' + caseName + '」已创建，执行服务离线无法执行'
        };
      }

      return {
        success: true,
        caseName: caseName,
        message: '用例「' + caseName + '」已创建并开始执行'
      };

    } catch (e) {
      return { success: false, error: e.message || '网络错误，请检查平台是否已启动' };
    } finally {
      setBtnLoading(false);
    }
  }

  // 同步成功后，即时把弹窗中对应步骤标记为"已生成"
  function markStepsAsExportedInModal(caseName, stepTexts) {
    var normSet = {};
    stepTexts.forEach(function (t) { normSet[normalizeForCompare(t)] = true; });
    var items = document.querySelectorAll('#midscene-steps-container .midscene-step-item');
    items.forEach(function (item) {
      var textEl = item.querySelector('.midscene-step-text');
      if (!textEl) return;
      var raw = textEl.dataset.fullText || textEl.textContent;
      if (normSet[normalizeForCompare(raw)]) {
        var cb = item.querySelector('.midscene-step-checkbox');
        if (cb) { cb.checked = false; }
        item.classList.remove('checked');
        item.classList.add('disabled', 'exported');
        var badge = item.querySelector('.midscene-step-status');
        if (badge) { badge.className = 'midscene-step-status exported'; badge.textContent = '↺'; }
        if (!item.querySelector('.midscene-step-exported-badge')) {
          var eb = document.createElement('span');
          eb.className = 'midscene-step-exported-badge';
          eb.textContent = '已生成: ' + caseName;
          eb.title = '该步骤已生成过用例：' + caseName;
          item.appendChild(eb);
        }
      }
    });
    updateStepCount();
  }

  // ─── Generate handler ──────────────────────────────────────
  function handleCopy() {
    var validation = validateForm();
    if (!validation.valid) {
      showValidationErrors(validation.errors);
      return;
    }

    sendToPlatform().then(function (result) {
      if (result.success) {
        var isWarning = result.warning || result.message.indexOf('离线') >= 0 || result.message.indexOf('无法执行') >= 0;
        showBanner(result.message, isWarning ? 'warning' : 'success');
      } else {
        showBanner(result.error, 'error');
      }
    });
  }

  // ─── 随机数生成 ────────────────────────────────────────────
  function openRandomDialog() {
    var overlay = document.getElementById('midscene-random-overlay');
    if (overlay) overlay.classList.add('active');
    var digitsEl = document.getElementById('midscene-random-digits');
    if (digitsEl) digitsEl.focus();
    generateRandomPreview();
  }

  function closeRandomDialog() {
    var overlay = document.getElementById('midscene-random-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function generateRandomPreview() {
    var digitsEl = document.getElementById('midscene-random-digits');
    var resultEl = document.getElementById('midscene-random-result');
    if (!digitsEl || !resultEl) return '';
    var digits = parseInt(digitsEl.value, 10);
    if (!digits || digits < 1) digits = 11;
    if (digits > 32) digits = 32;
    var num = '';
    for (var i = 0; i < digits; i++) {
      num += i === 0 ? String(1 + Math.floor(Math.random() * 9)) : String(Math.floor(Math.random() * 10));
    }
    resultEl.textContent = num;
    return num;
  }

  // 将文本插入聊天输入框（兼容 React 受控组件）
  function insertIntoChatInput(text) {
    var el = document.querySelector('#root textarea') || document.querySelector('textarea');
    if (el && el.tagName === 'TEXTAREA') {
      var cur = el.value;
      var pos = (typeof el.selectionStart === 'number') ? el.selectionStart : cur.length;
      var newText = cur.slice(0, pos) + text + cur.slice(pos);
      var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(el, newText);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
      return true;
    }
    el = document.querySelector('#root [contenteditable="true"]') || document.querySelector('[contenteditable="true"]');
    if (el && el.isContentEditable) {
      el.focus();
      document.execCommand('insertText', false, text);
      return true;
    }
    return false;
  }

  function handleRandomGenerate() {
    var num = generateRandomPreview();
    if (!num) return;
    var inserted = insertIntoChatInput(num);
    if (inserted) {
      closeRandomDialog();
    } else {
      try {
        navigator.clipboard.writeText(num).catch(function () {});
      } catch (e) {}
      var resultEl = document.getElementById('midscene-random-result');
      if (resultEl) resultEl.textContent = num + '（未找到输入框，已复制到剪贴板，请手动粘贴）';
    }
  }

  // ─── Project cache helpers ─────────────────────────────────
  function saveProjectToCache(projectId, projectName) {
    try {
      localStorage.setItem('midscene_project_id', projectId);
      localStorage.setItem('midscene_project_name', projectName);
    } catch (e) {}
  }

  function getCachedProjectName() {
    try { return localStorage.getItem('midscene_project_name') || ''; } catch (e) { return ''; }
  }

  // ─── Token persistence helpers ─────────────────────────────
  function clearAuthData() {
    _authToken = null;
    _currentUser = null;
    _state = STATE.UNAUTHENTICATED;
    try {
      localStorage.removeItem('midscene_auth_token');
      localStorage.removeItem('midscene_auth_username');
    } catch (e) {}
    updateToolbarDisplay();
    updateExportBtnState();
  }

  function handleLogout() {
    if (!confirm('确定要退出登录吗？')) return;
    clearAuthData();
    hideProjectDialog();
    showAuthOverlay();
  }

  function updateToolbarDisplay() {
    var userEl = document.getElementById('midscene-user-display');
    var logoutBtn = document.getElementById('midscene-logout-btn');
    if (_state === STATE.READY && _currentUser) {
      if (userEl) {
        userEl.textContent = '用户: ' + (_currentUser.displayName || _currentUser.username);
        userEl.style.display = '';
      }
      if (logoutBtn) logoutBtn.style.display = '';
    } else {
      if (userEl) userEl.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  // ─── Auth overlay ──────────────────────────────────────────
  function showAuthOverlay() {
    var overlay = document.getElementById('midscene-auth-overlay');
    if (overlay) overlay.classList.add('active');
    var errorEl = document.getElementById('midscene-auth-error');
    if (errorEl) errorEl.classList.remove('show');
    var usernameEl = document.getElementById('midscene-auth-username');
    var passwordEl = document.getElementById('midscene-auth-password');
    if (usernameEl) usernameEl.value = '';
    if (passwordEl) passwordEl.value = '';
  }

  function hideAuthOverlay() {
    var overlay = document.getElementById('midscene-auth-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  async function handleLogin() {
    var usernameEl = document.getElementById('midscene-auth-username');
    var passwordEl = document.getElementById('midscene-auth-password');
    var errorEl = document.getElementById('midscene-auth-error');
    var btn = document.getElementById('midscene-auth-login-btn');

    var username = usernameEl ? usernameEl.value.trim() : '';
    var password = passwordEl ? passwordEl.value : '';

    if (!username || !password) {
      if (errorEl) { errorEl.textContent = '请输入账号和密码'; errorEl.classList.add('show'); }
      return;
    }

    if (btn) btn.disabled = true;

    var result = await MidsceneAuth.login(username, password);
    if (result.success) {
      _authToken = result.token;
      _currentUser = result.user;
      try {
        localStorage.setItem('midscene_auth_token', result.token);
        localStorage.setItem('midscene_auth_username', result.user.username);
        localStorage.removeItem('midscene_project_list');
        localStorage.removeItem('midscene_project_id');
        localStorage.removeItem('midscene_project_name');
      } catch (e) {}
      _state = STATE.PROJECT_SELECT;
      hideAuthOverlay();
      showProjectDialog();
    } else {
      // 网络错误 → 弹出平台地址配置（可能平台地址不对或平台未启动）
      if (result.error && result.error.indexOf('网络错误') >= 0) {
        if (errorEl) { errorEl.textContent = result.error; errorEl.classList.add('show'); }
        openUrlConfigDialog();
      } else {
        if (errorEl) { errorEl.textContent = result.error || '账号/密码错误，请重新输入'; errorEl.classList.add('show'); }
      }
    }

    if (btn) btn.disabled = false;
  }

  // ─── 平台地址配置弹窗（连接失败时引导用户修正地址） ────────
  function openUrlConfigDialog() {
    var overlay = document.getElementById('midscene-urlconfig-overlay');
    if (!overlay) return;
    overlay.classList.add('active');
    var inputEl = document.getElementById('midscene-urlconfig-input');
    if (inputEl) {
      inputEl.value = getPlatformUrl();
      inputEl.focus();
      inputEl.select();
    }
  }

  function closeUrlConfigDialog() {
    var overlay = document.getElementById('midscene-urlconfig-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function handleUrlConfigSave() {
    var inputEl = document.getElementById('midscene-urlconfig-input');
    if (!inputEl) return;
    var raw = (inputEl.value || '').trim();
    if (!raw) return;

    // 允许输入 "ip:port" 简写，自动补 http:// 前缀
    var url = raw.indexOf('://') >= 0 ? raw : 'http://' + raw;

    try { localStorage.setItem('midscene_platform_url', url); } catch (e) {}
    closeUrlConfigDialog();

    // 修正后自动重试登录（保留账号，密码重填）
    var errorEl = document.getElementById('midscene-auth-error');
    if (errorEl) { errorEl.textContent = '已更新平台地址，正在重试连接...'; errorEl.classList.add('show'); }
    handleLogin();
  }

  // ─── Project dialog ────────────────────────────────────────
  function showProjectDialog() {
    var overlay = document.getElementById('midscene-project-dialog-overlay');
    if (overlay) overlay.classList.add('active');

    var userEl = document.getElementById('midscene-proj-dialog-user');
    if (userEl && _currentUser) {
      userEl.textContent = '当前用户：' + (_currentUser.displayName || _currentUser.username);
    }

    var newInput = document.getElementById('midscene-proj-dialog-new-input');
    if (newInput) newInput.value = '';
    var newWrap = document.getElementById('midscene-proj-dialog-new-wrap');
    if (newWrap) newWrap.style.display = 'none';

    loadProjectDialogProjects();
  }

  function hideProjectDialog() {
    var overlay = document.getElementById('midscene-project-dialog-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  async function loadProjectDialogProjects() {
    var selectEl = document.getElementById('midscene-proj-dialog-select');
    var emptyMsg = document.getElementById('midscene-project-empty-msg');

    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">— 请选择项目 —</option>';

    var result = await MidsceneAuth.getProjects(_authToken);
    if (result.success && result.projects.length > 0) {
      if (emptyMsg) emptyMsg.style.display = 'none';

      try { localStorage.setItem('midscene_project_list', JSON.stringify(result.projects)); } catch (e) {}

      result.projects.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        selectEl.appendChild(opt);
      });

      try {
        var cachedId = localStorage.getItem('midscene_project_id');
        if (cachedId && result.projects.some(function (p) { return p.id === cachedId; })) {
          selectEl.value = cachedId;
        }
      } catch (e) {}
    } else {
      if (emptyMsg) emptyMsg.style.display = 'block';
    }

    var createOpt = document.createElement('option');
    createOpt.value = '__CREATE_NEW__';
    createOpt.textContent = '➕ 创建新项目…';
    selectEl.appendChild(createOpt);

    selectEl.onchange = function () {
      var wrap = document.getElementById('midscene-proj-dialog-new-wrap');
      var newInput = document.getElementById('midscene-proj-dialog-new-input');
      if (selectEl.value === '__CREATE_NEW__') {
        if (wrap) { wrap.style.display = 'block'; if (newInput) { newInput.value = ''; newInput.focus(); } }
      } else {
        if (wrap) wrap.style.display = 'none';
        if (newInput) newInput.value = '';
      }
      updateProjectConfirmBtn();
    };

    updateProjectConfirmBtn();
  }

  function updateProjectConfirmBtn() {
    var selectEl = document.getElementById('midscene-proj-dialog-select');
    var confirmBtn = document.getElementById('midscene-proj-dialog-confirm');
    if (!selectEl || !confirmBtn) return;

    var val = selectEl.value;
    var newInput = document.getElementById('midscene-proj-dialog-new-input');
    if (val === '__CREATE_NEW__') {
      confirmBtn.disabled = !(newInput && newInput.value.trim());
    } else {
      confirmBtn.disabled = !val;
    }
  }

  async function handleProjectConfirm() {
    var selectEl = document.getElementById('midscene-proj-dialog-select');
    if (!selectEl) return;

    var val = selectEl.value;
    var projectId, projectName;

    if (val === '__CREATE_NEW__') {
      var newName = document.getElementById('midscene-proj-dialog-new-input').value.trim();
      if (!newName) return;

      var result = await MidsceneAuth.createProject(_authToken, newName);
      if (!result.success) {
        alert(result.error || '创建项目失败');
        return;
      }
      projectId = result.project.id;
      projectName = result.project.name;
      try {
        var cachedList = JSON.parse(localStorage.getItem('midscene_project_list') || '[]');
        cachedList = cachedList.filter(function (p) { return p.id !== projectId; });
        cachedList.push({ id: projectId, name: projectName });
        localStorage.setItem('midscene_project_list', JSON.stringify(cachedList));
      } catch (e) {}
    } else {
      projectId = val;
      projectName = selectEl.options[selectEl.selectedIndex].text;
    }

    saveProjectToCache(projectId, projectName);
    _state = STATE.READY;
    hideProjectDialog();

    updateToolbarDisplay();
    updateExportBtnState();
  }

  function updateExportBtnState() {
    var btn = document.getElementById('midscene-export-btn');
    if (!btn) return;
    if (_state === STATE.READY) {
      btn.disabled = false;
      btn.title = '导出步骤到「' + getCachedProjectName() + '」';
    } else {
      btn.disabled = true;
      btn.title = '请先登录并选择项目';
    }
  }

  // ─── DOM text localization ─────────────────────────────────
  const translations = {
    'System': '系统',
    'No Code Generation Selected': '未选择代码生成类型',
    'Download as .ts file': '下载为 .ts 文件',
    'Download as .yaml file': '下载为 .yaml 文件',
    'Conflicting extension detected. Please disable the suspicious plugins and refresh the page. Guide:': '检测到扩展冲突。请禁用可疑插件并刷新页面。指南：',
    'Session Not Found': '未找到会话',
    'The requested session could not be found.': '请求的会话未找到。',
    'Selecting': '选择',
    ' means no code will be generated automatically.': ' 表示不会自动生成代码。',
    'To auto-generate': '要自动生成',
    ' set it as the default (click the pin icon on the right).': ' 请将其设置为默认（点击右侧的固定图标）。',
    'When you stop recording, the system will automatically generate code for the default type.': '当您停止录制时，系统将自动为默认类型生成代码。',
    'Welcome to Midscene.js Playground!': '可视化操作平台',
    'This is a panel for experimenting and testing Midscene.js features.': '用自然语言操控网页，自动生成测试用例。',
    'Please enter your instructions in the input box below to start experiencing.': '',
    'Playground': '面板',
    '"What do you want to do?"': '"请输入测试步骤"',
    'Please set up your environment variables before using.': '在开始使用前，请完成模型参数设置。',
    'Model Env Config': '大模型环境配置',
    'The format is KEY=VALUE and separated by new lines.': '格式为KEY=VALUE，并换行新增变量。',
    'These data will be saved ': '数据将',
    'locally in your browser': '本地保存在浏览器中',
    'Verify': '验证模型',
    'Verifying': '验证中...',
    'Save': '保存参数',
    'Generate code': '生成代码',
    'Code Generation': '代码生成'
  };

  function localizeDOM() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    const changes = [];
    while ((node = walker.nextNode())) {
      const text = node.nodeValue;
      if (!text || text.trim().length < 2) continue;
      let modified = text;
      let changed = false;
      for (const [en, zh] of Object.entries(translations)) {
        if (modified.indexOf(en) > -1) {
          modified = modified.split(en).join(zh);
          changed = true;
        }
      }
      if (changed) {
        changes.push({ node, newValue: modified });
      }
    }
    for (const { node, newValue } of changes) {
      node.nodeValue = newValue;
    }
  }

  function hideNavLinks() {
    const links = document.querySelectorAll('a');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.indexOf('github.com/web-infra-dev/midscene') > -1 ||
          href.indexOf('midscenejs.com/quick-experience') > -1) {
        link.style.display = 'none';
      }
    }
  }

  // ─── Token restoration on startup ──────────────────────────
  async function tryRestoreAuth() {
    var savedToken, savedUsername;
    try {
      savedToken = localStorage.getItem('midscene_auth_token');
      savedUsername = localStorage.getItem('midscene_auth_username');
    } catch (e) {}

    if (!savedToken) return false;

    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/auth/me', {
        headers: { 'Authorization': 'Bearer ' + savedToken }
      });
      if (!resp.ok) {
        clearAuthData();
        return false;
      }
      var user = await resp.json();
      _authToken = savedToken;
      _currentUser = user;
      return true;
    } catch (e) {
      _authToken = savedToken;
      try {
        _currentUser = { username: savedUsername || '未知' };
      } catch (e2) {}
      return true;
    }
  }

  // ─── Initialize ────────────────────────────────────────────
  function init() {
    tryRestoreAuth().then(function (restored) {
      if (restored) {
        hideAuthOverlay();
        MidsceneAuth.getProjects(_authToken).then(function (res) {
          if (res.success && res.projects.length > 0) {
            try { localStorage.setItem('midscene_project_list', JSON.stringify(res.projects)); } catch (e) {}
            var currentId = localStorage.getItem('midscene_project_id');
            if (currentId && !res.projects.some(function (p) { return p.id === currentId; })) {
              localStorage.removeItem('midscene_project_id');
              localStorage.removeItem('midscene_project_name');
            }
          }
        }).catch(function () {});
        try {
          var cachedProjectId = localStorage.getItem('midscene_project_id');
          if (cachedProjectId) {
            _state = STATE.READY;
            updateToolbarDisplay();
          } else {
            _state = STATE.PROJECT_SELECT;
            showProjectDialog();
          }
        } catch (e) {
          _state = STATE.PROJECT_SELECT;
          showProjectDialog();
        }
      } else {
        _state = STATE.UNAUTHENTICATED;
      }
      updateExportBtnState();
    });

    // 防重复绑定辅助：同一元素同一事件只绑定一次（waitForElements 会被多次调用）
    function bindOnce(el, mark, event, handler) {
      if (!el) return;
      if (el.dataset && el.dataset[mark] === '1') return;
      if (el.dataset) el.dataset[mark] = '1';
      el.addEventListener(event, handler);
    }

    const waitForElements = () => {
      const btn = document.getElementById('midscene-export-btn');
      const closeBtns = document.querySelectorAll('#midscene-modal-close, #midscene-modal-close-btn');
      const copyBtn = document.getElementById('midscene-modal-copy-btn');
      const clearHistoryBtn = document.getElementById('midscene-clear-history-btn');

      bindOnce(btn, 'stpExport', 'click', handleExport);
      closeBtns.forEach(function(el) {
        bindOnce(el, 'stpClose', 'click', hideModal);
      });
      bindOnce(copyBtn, 'stpCopy', 'click', handleCopy);
      bindOnce(clearHistoryBtn, 'stpClear', 'click', handleClearHistory);

      const overlay = document.getElementById('midscene-modal-overlay');
      bindOnce(overlay, 'stpOverlay', 'click', function (e) {
        if (e.target === this) hideModal();
      });

      // document 级事件用全局标记防重复
      if (!window.__stpKeydownBound) {
        window.__stpKeydownBound = true;
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            var modalActive = document.getElementById('midscene-modal-overlay').classList.contains('active');
            if (modalActive) hideModal();
            var randomActive = document.getElementById('midscene-random-overlay').classList.contains('active');
            if (randomActive) closeRandomDialog();
            var urlActive = document.getElementById('midscene-urlconfig-overlay').classList.contains('active');
            if (urlActive) closeUrlConfigDialog();
          }
        });
      }

      // Logout button
      bindOnce(document.getElementById('midscene-logout-btn'), 'stpLogout', 'click', handleLogout);

      // Random number button + dialog
      bindOnce(document.getElementById('midscene-random-btn'), 'stpRandom', 'click', openRandomDialog);
      bindOnce(document.getElementById('midscene-random-generate'), 'stpRandomGen', 'click', handleRandomGenerate);
      bindOnce(document.getElementById('midscene-random-cancel'), 'stpRandomCancel', 'click', closeRandomDialog);
      var randomDigitsEl = document.getElementById('midscene-random-digits');
      bindOnce(randomDigitsEl, 'stpRandomInput', 'input', generateRandomPreview);
      bindOnce(randomDigitsEl, 'stpRandomKey', 'keydown', function (e) {
        if (e.key === 'Enter') handleRandomGenerate();
      });
      bindOnce(document.getElementById('midscene-random-overlay'), 'stpRandomOverlay', 'click', function (e) {
        if (e.target === this) closeRandomDialog();
      });

      // 平台地址配置弹窗事件
      bindOnce(document.getElementById('midscene-urlconfig-save'), 'stpUrlSave', 'click', handleUrlConfigSave);
      bindOnce(document.getElementById('midscene-urlconfig-cancel'), 'stpUrlCancel', 'click', closeUrlConfigDialog);
      bindOnce(document.getElementById('midscene-urlconfig-overlay'), 'stpUrlOverlay', 'click', function (e) {
        if (e.target === this) closeUrlConfigDialog();
      });
      var urlConfigInput = document.getElementById('midscene-urlconfig-input');
      bindOnce(urlConfigInput, 'stpUrlInput', 'keydown', function (e) {
        if (e.key === 'Enter') handleUrlConfigSave();
      });

      // Auth overlay events
      bindOnce(document.getElementById('midscene-auth-login-btn'), 'stpLogin', 'click', handleLogin);
      bindOnce(document.getElementById('midscene-auth-password'), 'stpAuthKey', 'keydown', function (e) {
        if (e.key === 'Enter') handleLogin();
      });

      // Project dialog events
      bindOnce(document.getElementById('midscene-proj-dialog-confirm'), 'stpProjConfirm', 'click', handleProjectConfirm);
      bindOnce(document.getElementById('midscene-proj-dialog-cancel'), 'stpProjCancel', 'click', function () {
        hideProjectDialog();
        showAuthOverlay();
      });
      var newProjInput = document.getElementById('midscene-proj-dialog-new-input');
      bindOnce(newProjInput, 'stpNewProjInput', 'input', updateProjectConfirmBtn);
      bindOnce(newProjInput, 'stpNewProjKey', 'keydown', function (e) {
        if (e.key === 'Enter') handleProjectConfirm();
      });

      // Localize DOM and hide nav links
      localizeDOM();
      hideNavLinks();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitForElements);
    } else {
      waitForElements();
    }

    setTimeout(waitForElements, 500);
    setTimeout(waitForElements, 1500);
    setTimeout(waitForElements, 3000);

    // 初始化当前页面 URL（供步骤日志记录使用）
    refreshPageUrl();

    var observer = new MutationObserver(function() {
      localizeDOM();
      hideNavLinks();
      onDomMutation();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  init();
})();
