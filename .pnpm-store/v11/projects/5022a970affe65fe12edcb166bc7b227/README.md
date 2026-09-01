# 智能测试中台 - Vue3 重构版本

基于 Vue 3 + Vite + Element Plus + Pinia + Vue Router + TypeScript 的前端重构版本。

## 技术栈

- **Vue 3.4** - 渐进式 JavaScript 框架
- **Vite 5** - 下一代前端构建工具
- **Element Plus 2** - Vue 3 UI 组件库
- **Pinia 2** - Vue 状态管理
- **Vue Router 4** - Vue 官方路由
- **TypeScript 5** - JavaScript 超集
- **ECharts 5** - 数据可视化
- **Axios** - HTTP 请求库
- **js-yaml** - YAML 解析

## 项目结构

```
smart-testing-platform-vue3/
├── src/
│   ├── api/                    # API 层
│   │   ├── axios.ts           # Axios 实例配置
│   │   ├── project.ts         # 项目相关 API
│   │   ├── cases.ts           # 用例相关 API
│   │   ├── reports.ts         # 报告相关 API
│   │   └── config.ts          # 配置相关 API
│   ├── assets/
│   │   └── styles/            # 样式文件
│   │       ├── variables.scss # CSS 变量
│   │       └── global.scss    # 全局样式
│   ├── components/            # 组件库
│   │   ├── layout/           # 布局组件
│   │   ├── charts/           # 图表组件
│   │   ├── yaml/             # YAML 编辑器
│   │   └── common/           # 通用组件
│   ├── composables/          # 组合式函数
│   │   └── useYamlEditor.ts  # YAML 编辑器核心逻辑
│   ├── router/               # 路由配置
│   ├── stores/               # Pinia 状态管理
│   │   ├── project.ts        # 项目 Store
│   │   ├── cases.ts          # 用例 Store
│   │   └── stats.ts          # 报告/配置 Store
│   ├── types/                # TypeScript 类型定义
│   ├── utils/                # 工具函数
│   ├── views/                # 页面视图
│   │   ├── home/             # 首页
│   │   ├── create/           # 创建测试
│   │   ├── cases/            # 用例管理
│   │   ├── detail/           # 用例详情
│   │   ├── config/           # AI配置
│   │   └── reports/          # 报告中心
│   ├── App.vue
│   └── main.ts
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 功能模块

### 首页 (HomeView)
- 统计卡片：总项目数、总用例数、执行成功、执行失败
- 执行结果统计柱状图
- 全量测试用例近7日趋势折线图
- 各项目近七日成功率图表 + 数据表格
- 最近测试用例列表

### 创建测试 (CreateView)
- NLP 输入 + 项目选择/新建
- YAML 编辑器 Tab切换（表单编辑/YAML预览）
- Web/Task/Flow 配置
- Flow步骤类型：AI操作、等待、AI断言、自定义
- 添加/删除步骤
- 同步到表单、复制、下载
- **执行日志终端（默认缩小，显示简化信息：执行中/成功/失败）**
- 自定义YAML执行

### 用例管理 (CasesView)
- 项目筛选
- 批量删除
- **批量纳管到项目**
- **按项目分组（展开/折叠）**
  - 折叠时显示简要信息（用例总数、成功数、失败数）
- 状态Tab筛选（全部/成功/失败/执行中/待执行）

### 用例详情 (DetailView)
- NLP 步骤展示
- YAML 编辑器
- AI 配置参数展示
- 报告链接

### AI配置 (ConfigView)
- 模型参数：Base URL、API Key、模型名称、模型家族
- 浏览器模式：Headless/Headful 切换

### 报告中心 (ReportsView)
- 所有测试报告列表
- 报告详情查看

## 安装和运行

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm run dev
```

访问 http://localhost:3000

### 构建生产版本

```bash
pnpm run build
```

### 预览生产版本

```bash
pnpm run preview
```

## API 配置

项目默认代理到 `http://localhost:3001`，如需修改请编辑 `vite.config.ts`：

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001', // 修改为你的后端地址
      changeOrigin: true
    }
  }
}
```

## 与后端配合

后端 API 需要实现以下接口：

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | /api/projects | 获取所有项目 |
| POST | /api/projects | 创建项目 |
| DELETE | /api/projects/:id | 删除项目 |
| GET | /api/cases | 获取所有用例 |
| POST | /api/cases | 创建用例 |
| PUT | /api/cases/:id | 更新用例 |
| DELETE | /api/cases/:id | 删除用例 |
| POST | /api/cases/batch-delete | 批量删除 |
| POST | /api/cases/adopt | 批量纳管 |
| POST | /api/cases/:id/execute | 执行用例 |
| GET | /api/reports | 获取所有报告 |
| GET | /api/stats | 获取统计数据 |
| GET | /api/stats/daily | 获取每日统计 |
| GET | /api/stats/projects | 获取项目统计 |
| GET | /api/config/ai | 获取AI配置 |
| POST | /api/config/ai | 保存AI配置 |

## License

MIT
