# Spec: 批量执行进度 UI

## 概述

前端提供批量执行入口和进度弹窗，让用户在用例列表中选择多个用例一键执行，并实时查看执行进度。

## 批量执行入口

**位置**: `views/cases/index.vue` 工具栏

- 在已有"批量删除"按钮旁新增"批量执行"按钮
- 按钮 disabled 条件: `selectedCases.length === 0`
- 点击流程:
  1. 校验 `selectedCases.length > 0`
  2. 调用 `batchExecuteCases(selectedCases.map(c => c.id))`
  3. 获取 `batchId`
  4. 弹出 `BatchProgressDialog`，传入 `batchId`

## 进度弹窗 (BatchProgressDialog)

**Props**:
- `visible: boolean` — 弹窗显示控制
- `batchId: string` — 批次 ID

**布局**:
```
┌──────────────────────────────────────┐
│  批量执行进度                     ✕  │
├──────────────────────────────────────┤
│                                      │
│  ████████████░░░░░░  2/3 已完成      │
│  成功 1 · 失败 1 · 执行中 1         │
│                                      │
│  ┌──────────────────────────────┐    │
│  │ 用例名称       状态    耗时  │    │
│  │ 登录功能测试    ✓ 成功  12s  │    │
│  │ 搜索功能测试    ✗ 失败  8s  │    │
│  │ 下单功能测试    ◎ 执行中    │    │
│  └──────────────────────────────┘    │
│                                      │
│           [关闭]                     │
└──────────────────────────────────────┘
```

**组件规格**:

1. **进度条** (`el-progress`)
   - `percentage = Math.round((completed / total) * 100)`
   - `format = "{completed}/{total} 已完成"`
   - `stroke-width = 20`
   - 进度条颜色: 全部成功绿色、存在失败橙色、存在执行中蓝色

2. **统计摘要** (`el-text`)
   - `成功 {success} · 失败 {failed} · 执行中 {running}`
   - 状态使用 `el-tag` 显示，颜色映射:
     - SUCCESS → green
     - FAILED → red
     - RUNNING → blue

3. **用例列表** (`el-table`)
   - 列: 用例名称、状态(el-tag)、耗时
   - 状态 Tag 颜色: SUCCESS=success, FAILED=danger, RUNNING=warning
   - 耗时格式: ms→s（与现有报告列表一致）
   - 数据: `progress.cases` 数组
   - 无数据: 显示 loading 状态

4. **轮询逻辑**
   - `watch(visible)`: 弹窗打开时启动轮询，关闭时停止
   - 轮询间隔: 3000ms
   - 调用 `getBatchProgress(batchId)`
   - `status === 'COMPLETED'` 时: 停止轮询，显示最终结果
   - 弹窗关闭时: 清除定时器

5. **错误处理**
   - API 调用失败时显示 `ElMessage.error`
   - 不中断轮询（容错）
