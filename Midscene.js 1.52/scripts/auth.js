/**
 * auth.js — 插件认证模块
 * 提供登录、项目列表、创建项目等 API 调用
 */

(function () {
  'use strict';

  // ─── Platform URL ──────────────────────────────────────────
  function getPlatformUrl() {
    try {
      return localStorage.getItem('midscene_platform_url') || 'http://localhost:8081';
    } catch (e) { return 'http://localhost:8081'; }
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
      return { success: false, error: '网络错误，请检查中台是否已启动' };
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
      var resp = await fetch(platformUrl + '/api/platform/projects?size=500', {
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
      return { success: false, error: '网络错误，请检查中台是否已启动' };
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
      return { success: false, error: '网络错误，请检查中台是否已启动' };
    }
  }

  // ─── Expose to global scope ────────────────────────────────
  window.MidsceneAuth = {
    login: login,
    getProjects: getProjects,
    createProject: createProject,
    getPlatformUrl: getPlatformUrl
  };
})();
