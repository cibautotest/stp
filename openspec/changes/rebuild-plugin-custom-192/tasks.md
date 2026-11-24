# 实施任务清单

## 插件重建（1.92_0 基底）

- [x] 1. 复制 `1.92_0` → 新目录 `测试用例可视化插件-v1.92/`
- [x] 2. manifest.json：name 改「测试用例可视化插件」、删 key/update_url
- [x] 3. 新增 `scripts/auth.js`（复用已验证实现：login 读 token、projects size=100、createProject）
- [x] 4. 新增 `scripts/export-test-case.js`：状态机 + 失败默认排除 + 已生成标记（项目维度指纹、用例名小标、追加记录）+ 随机数按钮逻辑 + create-and-execute 同步
- [x] 5. 改造 index.html：保留官方 bundle 引用；注入定制 CSS/DOM（工具栏含版本标识与随机数按钮、导出弹窗、登录遮罩、项目弹窗、随机数弹窗）；**去掉隐藏版本号脚本**；「中台」文案改「平台」
- [ ] 6. 手动验收（用户）：卸载旧 1.52/1.92_old 导入版 → 加载新目录 → 登录 → 选项目 → 执行 → 导出（验证失败/已生成标记）→ 随机数 → 一键同步

## execute-service 升级

- [x] 7. package.json @midscene/core、@midscene/web → `1.12.2`
- [x] 8. `npm install`（先删 node_modules\@midscene 后安装，实际解析 1.12.2）
- [x] 9. `tsc` 编译验证通过（零错误）；运行时验证 PlaywrightAgent/ReportMergingTool 正常导出；已重启执行引擎生效
- [ ] 10. 回归验证（需运行环境）：YAML 执行 + 缓存命中 + NLP 执行 + 报告合并

## 收尾

- [x] 11. 交付说明：提示用户卸载旧扩展、qwen3 应填 `qwen3-vl`
- [ ] 12. 归档变更（openspec archive，验收通过后）
