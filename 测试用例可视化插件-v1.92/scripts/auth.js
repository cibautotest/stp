/**
 * auth.js — 插件认证模块（测试用例可视化插件 v1.92）
 * 提供登录、项目列表、创建项目等平台 API 调用
 *
 * 对接接口：
 *   POST /api/platform/auth/login          登录（响应体含 token + user）
 *   GET  /api/platform/auth/me             当前用户（Bearer）
 *   GET  /api/platform/projects?size=100    项目列表（分页上限 100，读 items 字段）
 *   POST /api/platform/projects            创建项目（重名时返回已有项目并授权）
 */

(function () {
  'use strict';

  // ─── Platform URL ──────────────────────────────────────────
  var DEFAULT_PLATFORM_URL = 'http://10.3.71.299:8081';

  function getPlatformUrl() {
    try {
      return localStorage.getItem('midscene_platform_url') || DEFAULT_PLATFORM_URL;
    } catch (e) { return DEFAULT_PLATFORM_URL; }
  }

  function setPlatformUrl(url) {
    try { localStorage.setItem('midscene_platform_url', url); } catch (e) {}
  }

  // ─── Login ─────────────────────────────────────────────────
  /**
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{success: boolean, token?: string, user?: object, error?: string}>}
   */
  async function login(username, password) {
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
      });

      if (!resp.ok) {
        var errData = await resp.json().catch(function () { return {}; });
        return { success: false, error: errData.error || '用户名或密码错误' };
      }

      var data = await resp.json();
      if (!data.token) {
        return { success: false, error: '登录响应缺少 token' };
      }

      return { success: true, token: data.token, user: data.user };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Get project list ──────────────────────────────────────
  /**
   * @param {string} token
   * @returns {Promise<{success: boolean, projects?: Array, error?: string}>}
   */
  async function getProjects(token) {
    var platformUrl = getPlatformUrl();
    try {
      // 后端分页 size 上限为 100（@Max(100) 校验）
      var resp = await fetch(platformUrl + '/api/platform/projects?size=100', {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!resp.ok) {
        return { success: false, error: '获取项目列表失败' };
      }

      var data = await resp.json();
      var projects = data.items || data.records || data || [];
      if (!Array.isArray(projects)) projects = [];
      return { success: true, projects: projects };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Create project ────────────────────────────────────────
  /**
   * @param {string} token
   * @param {string} name
   * @returns {Promise<{success: boolean, project?: object, error?: string}>}
   */
  async function createProject(token, name) {
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ name: name })
      });

      if (resp.ok || resp.status === 200) {
        // 200: project already exists, 201: created
        var project = await resp.json();
        return { success: true, project: project };
      }

      var errData = await resp.json().catch(function () { return {}; });
      return { success: false, error: errData.error || '创建项目失败' };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Get case directories of a project ─────────────────────
  /**
   * @param {string} token
   * @param {string} projectId
   * @returns {Promise<{success: boolean, directories?: Array, error?: string}>}
   */
  async function getDirectories(token, projectId) {
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/case-directories?projectId=' + encodeURIComponent(projectId), {
        headers: { 'Authorization': 'Bearer ' + token }
      });

      if (!resp.ok) {
        return { success: false, error: '获取目录列表失败' };
      }

      var data = await resp.json();
      var directories = Array.isArray(data) ? data : (data.items || data.records || []);
      if (!Array.isArray(directories)) directories = [];
      return { success: true, directories: directories };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Create case directory ─────────────────────────────────
  /**
   * @param {string} token
   * @param {string} projectId
   * @param {string} name
   * @returns {Promise<{success: boolean, directory?: object, error?: string}>}
   */
  async function createDirectory(token, projectId, name) {
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/case-directories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ projectId: projectId, name: name })
      });

      if (resp.ok) {
        var directory = await resp.json();
        return { success: true, directory: directory };
      }

      var errData = await resp.json().catch(function () { return {}; });
      return { success: false, error: errData.error || '创建目录失败' };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Get login methods of a project ────────────────────────
  async function getLoginMethods(token, projectId) {
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/login-methods?projectId=' + encodeURIComponent(projectId), {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!resp.ok) return { success: false, error: '获取登录方式列表失败' };
      var data = await resp.json();
      return { success: true, methods: Array.isArray(data) ? data : [] };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Create login method ───────────────────────────────────
  async function createLoginMethod(token, payload) {
    var platformUrl = getPlatformUrl();
    try {
      var resp = await fetch(platformUrl + '/api/platform/login-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        return { success: true, method: await resp.json() };
      }
      var errData = await resp.json().catch(function () { return {}; });
      return { success: false, error: errData.error || '创建登录方式失败' };
    } catch (e) {
      return { success: false, error: '网络错误，请检查平台是否已启动' };
    }
  }

  // ─── Expose to global scope ────────────────────────────────
  window.MidsceneAuth = {
    login: login,
    getProjects: getProjects,
    createProject: createProject,
    getDirectories: getDirectories,
    createDirectory: createDirectory,
    getLoginMethods: getLoginMethods,
    createLoginMethod: createLoginMethod,
    getPlatformUrl: getPlatformUrl
  };
})();
