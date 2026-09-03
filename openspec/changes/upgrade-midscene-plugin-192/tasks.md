# 实施任务清单

## 后端配合改动（platform-service）

- [x] 1. AuthService.login：响应体 Map 增加 `token` 字段（Cookie 逻辑不动）
- [x] 2. SecurityConfig：新增 CORS 配置（allowedOriginPatterns 可配置默认 `*`，方法 GET/POST/PUT/DELETE/OPTIONS，头 Authorization/Content-Type/X-Requested-With），并在 filterChain 中启用 `http.cors()`
- [x] 3. 编译验证：`mvn -pl platform-service -am compile` 通过；确认登录接口响应体含 token 且 Cookie 照常下发

## 插件升级（Midscene.js 1.92 目录就地定制）

- [x] 4. manifest.json：name 改为「测试用例可视化插件」；删除 `key` 与 `update_url`；其余字段不动
- [x] 5. 新增 `scripts/auth.js`：以 1.52 版为基底移植，getProjects 改 `size=100`，「中台」文案改「平台」，登录读响应体 token
- [x] 6. 新增 `scripts/export-test-case.js`：以 1.52 版为基底移植，执行接口改为一步式 `POST /api/platform/execute/create-and-execute`（含 401 重新登录、离线降级 warning）、「中台」文案改「平台」
- [x] 7. 改造 index.html：保留 1.92 官方 bundle 引用；注入定制 CSS；在官方 bundle 之前引入 auth.js 与 export-test-case.js；注入工具栏/导出弹窗/登录遮罩/项目弹窗 DOM 与隐藏版本号脚本；全部「中台」文案改「平台」
- [x] 8. 校验翻译字典：对照 1.92 bundle 中实际英文文案补充/裁剪字典条目（重点：欢迎语、输入框占位、模型配置相关文案）
- [ ] 9. 手动验收（需用户配合）：加载插件 → 登录 → 选项目 → 对话执行 → 导出步骤 → 生成用例，平台侧确认用例创建与执行

## execute-service 升级

- [x] 10. package.json：`@midscene/core` 与 `@midscene/web` 版本改为 `1.9.2`（修正无效的 `^1.12.1`）
- [x] 11. 依赖安装：因 Windows 环境下 pnpm junction 链接在中文路径持续报 UNKNOWN 错误，改用 `npm install` 完成（更新的是 package-lock.json；pnpm-lock.yaml 仍为 1.8.3 旧记录，后续可择机重跑 pnpm 生成）
- [x] 12. `pnpm run build`（tsc）编译通过，重点检查 PlaywrightAgent 构造参数类型（`cache: { id }`）与 ReportMergingTool 导出 —— tsc 零错误，且运行时加载验证 PlaywrightAgent/ReportMergingTool 均正常导出
- [ ] 13. 回归验证（需运行环境）：YAML 模式执行用例 → 缓存文件生成 → 二次执行命中缓存；NLP 模式执行；测试计划合并报告；平台报告中心展示正常

## 收尾

- [x] 14. 文档说明：README 与 docs/design-document.md 中插件章节描述的旧对接流程（两步式创建+执行）已过时，本次未直接改动参赛文档原文，后续可按需更新
- [ ] 15. 归档变更（openspec archive，待手动验收通过后执行）
