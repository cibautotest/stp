/**
 * export-test-case.js — 用例导出模块（基于 Midscene 1.92 定制版）
 *
 * 核心流程（三阶段状态机）：
 *   UNAUTHENTICATED（登录遮罩）→ PROJECT_SELECT（项目选择/创建）→ READY（就绪）
 *
 * 一键同步平台（一步式接口）：
 *   POST /api/platform/execute/create-and-execute  Body: { projectId, name, nlp }
 *   success=true  → 创建并开始异步执行
 *   success=false → 用例已创建但执行服务离线（warning 降级提示）
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

  // ─── Extract user prompts (all default to success) ───────────
  function extractUserPrompts() {
    const bubbles = document.querySelectorAll('.user-message-bubble');
    const steps = [];
    for (const el of bubbles) {
      const text = el.textContent.trim();
      if (text) {
        steps.push({ text: text, status: 'success' });
      }
    }
    return steps;
  }

  // ─── Background polling for steps that turn out to fail ──────
  var _pollFailTimer = null;
  var _pollBubbleCount = 0;

  // Collect all text nodes between elStart and elEnd in document order
  function collectTextBetween(elStart, elEnd) {
    var texts = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var pastStart = false;
    var charCount = 0;
    var node;

    while ((node = walker.nextNode())) {
      if (!pastStart) {
        if (elStart.contains(node)) pastStart = true;
        continue;
      }

      // Stop at elEnd's bubble
      if (elEnd && elEnd.contains(node)) break;

      // Stop at ANY other user-message-bubble
      var p = node.parentElement;
      while (p) {
        if (p !== elStart && p.classList && p.classList.contains('user-message-bubble')) {
          return texts.join('');
        }
        p = p.parentElement;
      }

      // Last step (no elEnd): only scan within #root to avoid export modal
      if (!elEnd) {
        var inChat = false;
        p = node.parentElement;
        while (p) {
          if (p.id === 'root') { inChat = true; break; }
          p = p.parentElement;
        }
        if (!inChat) break;
      }

      texts.push(node.nodeValue);
      charCount += node.nodeValue.length;
      // Safety cap: 2000 chars is plenty for one AI response
      if (charCount > 2000) break;
    }

    return texts.join('');
  }

  function startPollingForFailures() {
    stopPollingForFailures();
    _pollBubbleCount = document.querySelectorAll('.user-message-bubble').length;

    _pollFailTimer = setInterval(function () {
      var items = document.querySelectorAll('#midscene-steps-container .midscene-step-item');
      var bubbles = document.querySelectorAll('.user-message-bubble');
      var stopNow = false;

      if (bubbles.length !== _pollBubbleCount) stopNow = true;

      if (!stopNow) {
        for (var i = 0; i < bubbles.length; i++) {
          if (i >= items.length) break;
          var item = items[i];
          var checkbox = item.querySelector('.midscene-step-checkbox');
          var badge = item.querySelector('.midscene-step-status');
          if (!checkbox || !badge) continue;
          if (badge.classList.contains('failure')) continue;

          // Collect DOM text between this bubble and the next bubble
          var nextBubble = (i + 1 < bubbles.length) ? bubbles[i + 1] : null;
          var segment = collectTextBetween(bubbles[i], nextBubble);

          if (segment.indexOf('Task failed') >= 0 || segment.indexOf('failed') >= 0 || segment.indexOf('✗') >= 0 || segment.indexOf('失败') >= 0) {
            checkbox.checked = false;
            item.classList.remove('checked');
            item.classList.add('disabled');
            badge.className = 'midscene-step-status failure';
            badge.textContent = '✗';
            updateStepCount();
          }
        }
      }

      if (stopNow) stopPollingForFailures();
    }, 1000);
  }

  function stopPollingForFailures() {
    if (_pollFailTimer) {
      clearInterval(_pollFailTimer);
      _pollFailTimer = null;
    }
  }

  // ─── Render the steps list into the modal ─────────────────────
  function renderStepList(steps) {
    const container = document.getElementById('midscene-steps-container');
    const countEl = document.getElementById('midscene-step-count');
    if (!container) return;

    container.innerHTML = '';

    if (steps.length === 0) {
      container.innerHTML = '<div class="empty-msg" style="padding:20px 0;">当前对话中没有找到用户消息。</div>';
      if (countEl) countEl.textContent = '已选择 0 个步骤';
      return;
    }

    steps.forEach(function (step, i) {
      const item = document.createElement('div');
      item.className = 'midscene-step-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'midscene-step-checkbox';
      checkbox.checked = true;
      checkbox.dataset.index = i;

      var badgeClass = 'midscene-step-status';
      var badgeIcon = '';
      if (step.status === 'failure') {
        badgeClass += ' failure';
        badgeIcon = '✗';
      } else if (step.status === 'loading') {
        badgeClass += ' loading';
        badgeIcon = '⏳';
      } else {
        badgeClass += ' success';
        badgeIcon = '✓';
      }
      const badge = document.createElement('span');
      badge.className = badgeClass;
      badge.textContent = badgeIcon;

      const textSpan = document.createElement('span');
      textSpan.className = 'midscene-step-text';
      textSpan.textContent = step.text;

      item.appendChild(checkbox);
      item.appendChild(badge);
      item.appendChild(textSpan);

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

  // ─── Update step count display ────────────────────────────────
  function updateStepCount() {
    const checkboxes = document.querySelectorAll('#midscene-steps-container .midscene-step-checkbox');
    const countEl = document.getElementById('midscene-step-count');
    if (!countEl) return;
    const checked = Array.from(checkboxes).filter(function (cb) { return cb.checked; }).length;
    countEl.textContent = '已选择 ' + checked + ' / ' + checkboxes.length + ' 个步骤';
  }

  // ─── Build clipboard text from form + checked steps ───────────
  function buildClipboardText() {
    var selectEl = document.getElementById('midscene-project-select');
    var projectName = selectEl ? selectEl.options[selectEl.selectedIndex].text : '';
    const caseName = document.getElementById('midscene-case-name').value.trim();
    const testUrl = document.getElementById('midscene-test-url').value.trim();
    const checkboxes = document.querySelectorAll('#midscene-steps-container .midscene-step-checkbox');
    const lines = [];

    if (projectName && projectName !== '— 请选择项目 —') lines.push('项目名称：' + projectName);
    if (caseName) lines.push('用例名称：' + caseName);
    if (testUrl) lines.push('测试网址：' + testUrl);

    var stepsAdded = false;
    checkboxes.forEach(function (cb, i) {
      if (cb.checked) {
        if (!stepsAdded && lines.length > 0) lines.push('');
        stepsAdded = true;
        const stepItem = cb.closest('.midscene-step-item');
        const textEl = stepItem ? stepItem.querySelector('.midscene-step-text') : null;
        if (textEl) {
          lines.push(textEl.textContent);
        }
      }
    });

    return lines.join('\n');
  }

  // ─── Populate export modal project dropdown ─────────────────
  function populateExportProjectDropdown() {
    var selectEl = document.getElementById('midscene-project-select');
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">— 请选择项目 —</option>';

    // Load cached project list from localStorage
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

    // Add "create new" option
    var createOpt = document.createElement('option');
    createOpt.value = '__CREATE_NEW__';
    createOpt.textContent = '➕ 创建新项目…';
    selectEl.appendChild(createOpt);

    // Pre-select current project
    try {
      var currentId = localStorage.getItem('midscene_project_id');
      if (currentId) {
        selectEl.value = currentId;
      }
    } catch (e) {}

    // Toggle new project input visibility
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
    };

    // Trigger initial visibility
    if (selectEl.value === '__CREATE_NEW__') {
      if (newGroup) newGroup.style.display = 'block';
    }
  }

  // ─── Form persistence ──────────────────────────────────────────
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
    // Fill with fresh URL from current tab
    var testUrlEl = document.getElementById('midscene-test-url');
    if (testUrlEl && freshUrl) {
      testUrlEl.value = freshUrl;
    }
  }

  // ─── UI: Show the modal ──────────────────────────────────────
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
    stopPollingForFailures();
    const overlay = document.getElementById('midscene-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  // ─── Refresh current tab URL ──────────────────────────────
  function refreshCurrentUrl(callback) {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var url = (tabs && tabs[0] && tabs[0].url && tabs[0].url.indexOf('chrome://') !== 0)
            ? tabs[0].url : '';
        callback(url);
      });
    } catch (e) {
      callback('');
    }
  }

  // ─── Main export handler ─────────────────────────────────────
  function handleExport() {
    if (_state !== STATE.READY) {
      showAuthOverlay();
      return;
    }
    var steps = extractUserPrompts();
    renderStepList(steps);
    // Refresh URL from current tab each time export is clicked
    refreshCurrentUrl(function (url) {
      showModal(url);
    });
    startPollingForFailures();
  }

  // ─── Form validation ────────────────────────────────────────
  function validateForm() {
    var selectEl = document.getElementById('midscene-project-select');
    var projectValue = selectEl ? selectEl.value : '';
    var isNewProject = projectValue === '__CREATE_NEW__';
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
    if (!caseName) errors.push('请输入用例名称');
    if (!testUrl) errors.push('请输入测试网址');
    if (checkedCount === 0) errors.push('请至少选择一个测试步骤');

    return { valid: errors.length === 0, errors: errors };
  }

  // ─── Show message in the top banner ────────────────────
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

  // ─── Platform API integration ──────────────────────────
  function getPlatformUrl() {
    try {
      return localStorage.getItem('midscene_platform_url') || 'http://localhost:8081';
    } catch (e) { return 'http://localhost:8081'; }
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

  /**
   * 一键同步平台（一步式）：
   * 先确保 projectId 就绪（必要时创建新项目），再拼接 NLP 调用
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

    // Collect checked steps
    var checkboxes = document.querySelectorAll('#midscene-steps-container .midscene-step-checkbox');
    var stepActions = [];
    checkboxes.forEach(function (cb) {
      if (cb.checked) {
        var stepItem = cb.closest('.midscene-step-item');
        var textEl = stepItem ? stepItem.querySelector('.midscene-step-text') : null;
        if (textEl) {
          var rawText = textEl.textContent;
          var colonIndex = rawText.indexOf(':');
          if (colonIndex >= 0) {
            stepActions.push(rawText.substring(colonIndex + 1).trim());
          } else {
            stepActions.push(rawText.trim());
          }
        }
      }
    });

    var nlpText = '打开' + testUrl;
    if (stepActions.length > 0) {
      nlpText += '，' + stepActions.join('，');
    }

    setBtnLoading(true);

    try {
      var projectId;

      if (isNewProject) {
        // Create new project first
        var newName = document.getElementById('midscene-new-project-input').value.trim();
        var createResult = await MidsceneAuth.createProject(token, newName);
        if (!createResult.success) {
          throw new Error(createResult.error || '创建项目失败');
        }
        projectId = createResult.project.id;
        // Update localStorage with new project
        var projectName = createResult.project.name;
        saveProjectToCache(projectId, projectName);
        // Add to cached list (deduped) so dropdown includes it now
        try {
          var cachedList = JSON.parse(localStorage.getItem('midscene_project_list') || '[]');
          // Remove duplicate then push
          cachedList = cachedList.filter(function (p) { return p.id !== projectId; });
          cachedList.push({ id: projectId, name: projectName });
          localStorage.setItem('midscene_project_list', JSON.stringify(cachedList));
        } catch (e) {}
        // Refresh dropdown silently
        populateExportProjectDropdown();
      } else {
        projectId = projectValue;
      }

      if (!projectId) {
        throw new Error('项目ID无效');
      }

      // 一步式：创建用例并触发异步执行
      var resp = await fetch(platformUrl + '/api/platform/execute/create-and-execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          projectId: projectId,
          name: caseName,
          nlp: nlpText
        })
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          // Token expired — clear and re-show login
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

      // success=false 表示用例已创建但执行服务离线
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

  // ─── Generate handler ─────────────────────────────────────
  function handleCopy() {
    stopPollingForFailures();

    var validation = validateForm();
    if (!validation.valid) {
      showValidationErrors(validation.errors);
      return;
    }

    var text = buildClipboardText();
    if (text) {
      try { navigator.clipboard.writeText(text).catch(function () {}); } catch (e) {}
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

  // ─── Project cache helpers ────────────────────────────────────
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

  // ─── Auth overlay ────────────────────────────────────────────
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
      // Persist token + username to localStorage
      try {
        localStorage.setItem('midscene_auth_token', result.token);
        localStorage.setItem('midscene_auth_username', result.user.username);
        // Clear old project cache (may be from a different user)
        localStorage.removeItem('midscene_project_list');
        localStorage.removeItem('midscene_project_id');
        localStorage.removeItem('midscene_project_name');
      } catch (e) {}
      _state = STATE.PROJECT_SELECT;
      hideAuthOverlay();
      showProjectDialog();
    } else {
      if (errorEl) { errorEl.textContent = result.error || '账号/密码错误，请重新输入'; errorEl.classList.add('show'); }
    }

    if (btn) btn.disabled = false;
  }

  // ─── Project dialog ──────────────────────────────────────────
  function showProjectDialog() {
    var overlay = document.getElementById('midscene-project-dialog-overlay');
    if (overlay) overlay.classList.add('active');

    // Show user greeting
    var userEl = document.getElementById('midscene-proj-dialog-user');
    if (userEl && _currentUser) {
      userEl.textContent = '当前用户：' + (_currentUser.displayName || _currentUser.username);
    }

    // Clear leftover new project name from previous session
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
    var confirmBtn = document.getElementById('midscene-proj-dialog-confirm');

    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">— 请选择项目 —</option>';

    var result = await MidsceneAuth.getProjects(_authToken);
    if (result.success && result.projects.length > 0) {
      if (emptyMsg) emptyMsg.style.display = 'none';

      // Cache project list (server is always source of truth; overwrite, don't merge)
      try { localStorage.setItem('midscene_project_list', JSON.stringify(result.projects)); } catch (e) {}

      result.projects.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        selectEl.appendChild(opt);
      });

      // Pre-select cached project
      try {
        var cachedId = localStorage.getItem('midscene_project_id');
        if (cachedId && result.projects.some(function (p) { return p.id === cachedId; })) {
          selectEl.value = cachedId;
        }
      } catch (e) {}
    } else {
      if (emptyMsg) emptyMsg.style.display = 'block';
    }

    // Add "create new" at end
    var createOpt = document.createElement('option');
    createOpt.value = '__CREATE_NEW__';
    createOpt.textContent = '➕ 创建新项目…';
    selectEl.appendChild(createOpt);

    // Change handler
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
      // Update project list cache (deduped)
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

    // Update toolbar and export button
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
  // 字典已对照 Midscene 1.92 官方 bundle 校准：
  //   - 'Save and Verify Model' 已拆分为 'Verify' / 'Verifying'
  //   - 移除 1.92 中不存在的 'Type a message...' / 'Assistant' 等旧文案
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
    if (changes.length > 0) {
      console.log('[Localization] Replaced ' + changes.length + ' text nodes');
    }
  }

  function hideNavLinks() {
    const links = document.querySelectorAll('a');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.indexOf('github.com/web-infra-dev/midscene') > -1 ||
          href.indexOf('midscenejs.com/quick-experience') > -1) {
        link.style.display = 'none';
        console.log('[Localization] Hidden link:', href);
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

    // Validate token via GET /auth/me
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/auth/me', {
        headers: { 'Authorization': 'Bearer ' + savedToken }
      });
      if (!resp.ok) {
        // Token expired or invalid — clear it
        clearAuthData();
        return false;
      }
      var user = await resp.json();
      _authToken = savedToken;
      _currentUser = user;
      return true;
    } catch (e) {
      // Network error — still use cached token
      _authToken = savedToken;
      try {
        _currentUser = { username: savedUsername || '未知' };
      } catch (e2) {}
      return true;
    }
  }

  // ─── Initialize ─────────────────────────────────────────────────
  function init() {
    // Try to restore auth from localStorage
    tryRestoreAuth().then(function (restored) {
      if (restored) {
        // Token valid — skip login, hide overlay, go to project select or ready
        hideAuthOverlay();
        // Silently refresh project list from server (may have changed)
        MidsceneAuth.getProjects(_authToken).then(function (res) {
          if (res.success && res.projects.length > 0) {
            try { localStorage.setItem('midscene_project_list', JSON.stringify(res.projects)); } catch (e) {}
            // If cached project no longer exists, clear selection → show dialog
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
        // No valid token — show login (overlay already active from HTML)
        _state = STATE.UNAUTHENTICATED;
      }
      updateExportBtnState();
    });

    const waitForElements = () => {
      // Export button handler
      const btn = document.getElementById('midscene-export-btn');
      const closeBtns = document.querySelectorAll('#midscene-modal-close, #midscene-modal-close-btn');
      const copyBtn = document.getElementById('midscene-modal-copy-btn');

      if (btn) {
        btn.addEventListener('click', handleExport);
      }
      closeBtns.forEach(function(el) {
        el.addEventListener('click', hideModal);
      });
      if (copyBtn) {
        copyBtn.addEventListener('click', handleCopy);
      }

      // Close modal on overlay click
      const overlay = document.getElementById('midscene-modal-overlay');
      if (overlay) {
        overlay.addEventListener('click', function (e) {
          if (e.target === this) hideModal();
        });
      }

      // Escape key
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          var modalActive = document.getElementById('midscene-modal-overlay').classList.contains('active');
          if (modalActive) {
            hideModal();
          }
        }
      });

      // Logout button
      var logoutBtn = document.getElementById('midscene-logout-btn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
      }

      // Auth overlay events
      var authLoginBtn = document.getElementById('midscene-auth-login-btn');
      if (authLoginBtn) {
        authLoginBtn.addEventListener('click', handleLogin);
      }
      var authPasswordEl = document.getElementById('midscene-auth-password');
      if (authPasswordEl) {
        authPasswordEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') handleLogin();
        });
      }

      // Project dialog events
      var projConfirmBtn = document.getElementById('midscene-proj-dialog-confirm');
      var projCancelBtn = document.getElementById('midscene-proj-dialog-cancel');
      if (projConfirmBtn) {
        projConfirmBtn.addEventListener('click', handleProjectConfirm);
      }
      if (projCancelBtn) {
        projCancelBtn.addEventListener('click', function () {
          hideProjectDialog();
          showAuthOverlay();
        });
      }
      // Update confirm btn when new project name changes
      var newProjInput = document.getElementById('midscene-proj-dialog-new-input');
      if (newProjInput) {
        newProjInput.addEventListener('input', updateProjectConfirmBtn);
        newProjInput.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') handleProjectConfirm();
        });
      }

      // Localize DOM and hide nav links
      localizeDOM();
      hideNavLinks();
    };

    // Run on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitForElements);
    } else {
      waitForElements();
    }

    // Re-run after React renders
    setTimeout(waitForElements, 500);
    setTimeout(waitForElements, 1500);
    setTimeout(waitForElements, 3000);

    // Also observe DOM changes
    var observer = new MutationObserver(function() {
      localizeDOM();
      hideNavLinks();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  init();
})();
