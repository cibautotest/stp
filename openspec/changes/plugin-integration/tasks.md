# Tasks: Midscene.js Chrome 插件集成

> **关联 PRD**: [proposal.md](./proposal.md) | **关联设计**: [design.md](./design.md)

---

## 1. 插件中心前端页面 — 基础搭建

- [x] 1.1 创建 `/plugins` 路由及 `views/plugins/index.vue` 页面
- [x] 1.2 实现 Hero 区域（插件名称、版本、描述、下载按钮）
- [x] 1.3 实现下载按钮 (`downloadExtension`)，读取 `/plugin/midscene-extension.zip`
- [x] 1.4 实现左侧安装步骤（el-steps 5 步引导）

## 2. 插件中心前端页面 — 安装步骤内容

- [x] 2.1 第 1 步：打开 Chrome 扩展程序管理页面（chrome://extensions/）
- [x] 2.2 第 2 步：开启开发者模式
- [x] 2.3 第 3 步：解压并加载插件
  - 先解压下载的 `可视化测试插件.zip`
  - 点击「加载已解压的扩展程序」
  - 选择解压后的 `可视化测试插件` 文件夹（路径：自定义保存路径\可视化测试插件）
- [x] 2.4 第 4 步：固定插件到工具栏
- [x] 2.5 第 5 步：开始使用（5 条操作指引）

## 3. 插件中心前端页面 — 右侧面板

- [x] 3.1 实现"使用提示"面板（中台地址配置、登录态说明、自动登录说明）
- [x] 3.2 实现"常见问题"面板（el-collapse FAQ）

## 4. 插件中心前端页面 — UI 精细打磨

- [x] 4.1 修复步骤描述文字溢出问题（添加 `overflow-wrap: break-word` / `word-break: break-all`）
- [x] 4.2 增大安装步骤框内边距（`padding: 24px` → `40px`）
- [x] 4.3 删除第 5 步第一条"打开需要测试的目标网站，并手动登录"（不再适用）

## 5. 扩展资源托管

- [x] 5.1 扩展 .zip 包放置于 `frontend/public/plugin/midscene-extension.zip`
- [x] 5.2 补充插件更新说明：修改 `Midscene.js 1.52` 目录后 → 手动 zip → 放至 `public/plugin` → 重命名为 `midscene-extension.zip`
