# 验收报告 — case-nlp-standardize-cache-visibility

日期：2026-09-29 ｜ 验收方式：API 级实测 + 单测

## 结论：通过（5/5）

| 项 | 结果 | 证据 |
|----|------|------|
| 编译验证 | ✅ | backend mvn test EXIT 0；execute-service tsc EXIT 0；前端 read_lints 零错误 |
| 单测 | ✅ | 新增 TestCaseServiceTest 3 例（统计分支/失败容错/变更条件）+ 既有全绿 |
| 缓存回源 | ✅ | 用例 2095700533465460737（DB 无缓存、磁盘有缓存）：直连 `:3001/cache` 200（979字符）→ 平台 `/cases/{id}/cache` 200 → DB 回填 979 字符 |
| 批量标准化 | ✅ | POST /cases/standardize-batch：total=24 changed=18 failed=0；存量用例 NLP 已含【动态】内联标签 |
| 创建时标准化 | ✅ | POST /cases 输入"登录系统，然后查看订单列表，输入短信验证码" → 存储为 6 行标准步骤，含"输入【动态】短信验证码" |

## 改动清单

- backend：TestCaseController（创建标准化 + standardize-batch + cache 回源）、TestCaseService（standardizeBatch + getCacheWithFallback）
- execute-service：新增 `GET /cache/:caseId` 路由（含路径穿越防护）
- frontend：用例管理工具栏"标准化存量用例"按钮 + api/cases.ts

## 探测数据清理

- probe-std-test 用例已删除 ✅
