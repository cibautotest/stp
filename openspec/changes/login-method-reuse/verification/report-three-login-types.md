# 三种登录方式端到端验收报告

日期：2026-09-30 ｜ 验收方式：API 级全链路实测（stp-e2e-verify SOP）

## 结论：全部通过（3/3 + 缓存提速实证）

| 登录方式 | 首次执行 | 二次执行（缓存） | cacheStatus 回调 | 结论 |
|---------|---------|----------------|-----------------|------|
| 免登录（none） | completed | — | — | ✅ NLP 无登录内容，自动打开目标网址后执行业务步骤 |
| CAS 登录 | completed 71s（AI 建缓存） | completed 16s | uncached→cached ✓ | ✅ 提速 77% |
| 本地登录（local） | completed 57s（AI 建缓存） | completed 16s | uncached→cached ✓ | ✅ 提速 72% |

## 核心需求验证

1. **"用户输入登录信息后，不需要在 NLP 输入框再输入这些内容"** ✅
   CAS/本地的业务 NLP 仅"点击顶部的用例管理菜单"（无网址/账号/密码），执行时登录方式独立完成登录后继续业务步骤。
2. **"用例管理里可以直接执行"** ✅
   二次执行均通过 `POST /execute/cases/{id}`（用例管理的执行入口）完成，登录方式自动注入。
3. **登录缓存跨执行复用** ✅
   `login_<methodId>.cache.yaml` 独立缓存，二次执行登录阶段命中缓存提速 72-77%。

## 验收过程中发现并修复的环境问题（已沉淀至 midscene-yaml-doctor 症状 5）

- **僵尸 vite 抢占 3001 双绑**：执行提交成功但状态 404、记录凭空 FAILED → 根治：vite.config.ts 加 `strictPort: true`
- **低内存机器 JVM malloc 失败**：start-platform.bat 已内置 MAVEN_OPTS=-Xmx256m + 各服务 jvmArguments 堆限制（Eureka/Gateway 384m、Platform 768m）

## 探测数据清理

- 6 个探测用例 + 2 个探测登录方式 + 对应缓存文件均已删除 ✅

## 存量用例场景补测（2026-09-30 第二轮）

| 场景 | 结果 | 证据 |
|------|------|------|
| 免登录存量用例再执行（execute/cases/{id}） | ✅ | 创建+首执 completed → 存量再执行 completed |
| 存量老用例绑定 CAS 登录方式后执行 | ✅ | 无登录方式用例 → PUT 绑定 → 执行 completed（46s，登录阶段建缓存）→ cacheStatus=cached |
| **修复**：`PUT /cases/{id}` 不复制 loginMethodId | ✅ 已修 | 补齐字段复制（空串=解绑），绑定后 GET 验证持久化 |

## 插件链路说明

插件导出弹窗调用的 API（auth/login、login-methods CRUD、create-and-execute 带 loginMethodId）与本次验证的平台 API 完全相同，链路已覆盖；插件 UI 交互（类型单选/角色下拉/确认保存按钮）需在浏览器中人工过一遍。
