# 提案：存量用例 NLP 标准化覆盖 + 用例缓存可见性修复

## 背景与问题

1. **NLP 标准化未覆盖存量用例**：`NlpStandardizationService.standardize()` 仅在 `createAndExecute` 链路调用。通过 `POST /cases` 直接创建的用例（创建按钮）及全部历史存量用例的步骤说明从未经过模型标准化（DB 验证：近 8 条用例 `has_dyn_tag` 大多为 0）。
2. **用例管理看不到最新缓存**：缓存查看链路为 执行引擎磁盘 → 执行后回传 DB `cache_content` → 前端弹窗展示。磁盘是真相源但回传可能缺失（DB 验证：近 8 条用例一半 `cache_content=NULL`，而磁盘存在对应缓存文件），导致"该用例暂无缓存文件"误报。

## 方案

1. `POST /cases` 创建时同样走 NLP 标准化（与 createAndExecute 一致）。
2. 新增批量标准化接口 `POST /api/platform/cases/standardize-batch?projectId=`：对项目下用例逐个标准化（AI 失败自动降级本地关键词标记，单条失败不阻塞整体），返回处理统计；前端用例管理工具栏加"标准化存量用例"按钮。
3. execute-service 新增 `GET /cache/:caseId`：返回磁盘缓存文件（真相源）。
4. 平台 `GET /cases/{id}/cache`：DB 无缓存时回源 execute-service 拉取磁盘缓存，成功后回填 DB 并返回——保证"看到的即最新"。

## 影响范围

- backend：TestCaseController、TestCaseService（新增批量方法）、NlpStandardizationService（复用）
- execute-service：routes 新增缓存查询端点
- frontend：用例管理工具栏 + api/cases.ts
