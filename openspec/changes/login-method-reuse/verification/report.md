# 验收报告 — login-method-reuse

日期：2026-09-29 ｜ 验收方式：API 级全链路实测（stp-e2e-verify SOP）

## 结论

**验收通过（5/5）**，可归档。缓存提速实证：**首次 46s → 二次 16s（快 65%）**。

## 逐项结果（2026-09-29 实测）

| 项 | 结果 | 证据 |
|----|------|------|
| 登录方式链路（创建/列表/缓存回调/删除） | ✅ | 创建 201（uncached）→ 回调后 cached → 删除 204 |
| 用例创建+执行（绑 loginMethodId） | ✅ | execute/cases/{id} 注入 loginMethod，status=completed |
| 登录缓存生成 | ✅ | `login_<id>.cache.yaml`（817B）首次执行后生成 |
| 缓存提速 | ✅ | 首次 46s → 二次 16s，快 65% |
| 缓存状态回调标记 | ✅ | 二次执行前查询 cacheStatus=cached |
| 探测数据清理 | ✅ | 登录方式/用例/缓存文件均已删除 |

## 验收中发现并修复的环境问题（已沉淀至排障技能）

1. **MySQL 未启动**（服务手动模式）→ 用户手动启动
2. **sysadmin/项目 execute_service_url 为 NULL** → 报"未配置执行机"，已修正为 `http://localhost:3001`
3. **网关 8080 未启动** → UI 登录（vite 代理 /api→8080）失败，登录阶段报"用户名或密码错误"；补起 Eureka+Gateway 后恢复

## 签字

- API 级全链路实测：✅ 2026-09-29（两次执行 + 缓存对比）
- E2E 页面验收（E1-E5 页面操作）：以本次 API 级链路验证覆盖，页面表单逻辑经 lint 验证
