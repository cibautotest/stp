// 项目类型
export interface Project {
  id?: string
  name: string
  description?: string
  executeServiceUrl?: string
  skywalkingGraphqlUrl?: string
  trafficTaggingEnabled?: boolean
  apiExchangeKafkaEnabled?: boolean
}

// 分页结果
export interface PageResult<T> {
  total: number
  page: number
  size: number
  items: T[]
}

// 测试用例类型 - 与后端匹配
export interface TestCase {
  id?: string
  project?: string
  projectId?: string
  directoryId?: string
  name?: string
  description?: string
  nlp?: string
  yamlFlow?: string
  executionMode?: 'NLP' | 'YAML'
  status?: CaseStatusType
  htmlReportPath?: string
  cacheContent?: string
  createdAt?: string
  executedAt?: string
}

// 统一的用例状态类型
export type CaseStatusType = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'UNKNOWN'

// 状态显示映射
export const STATUS_CONFIG: Record<CaseStatusType, { label: string; type: string; color: string }> = {
  PENDING: { label: '未执行', type: 'info', color: '#909399' },
  RUNNING: { label: '执行中', type: 'warning', color: '#409EFF' },
  SUCCESS: { label: '成功', type: 'success', color: '#67C23A' },
  FAILED: { label: '失败', type: 'danger', color: '#F56C6C' },
  UNKNOWN: { label: '未知', type: 'warning', color: '#E6A23C' }
}

// 执行结果统计
export interface ExecutionStats {
  totalProjects: number
  totalCases: number
  successCount: number
  failedCount: number
}

// 每日统计
export interface DailyStats {
  date: string
  success: number
  failed: number
}

// 项目近7日数据
export interface ProjectStats {
  project_id: number
  project_name: string
  daily_stats: DailyStats[]
  total: number
  success_rate: number
  min_success_rate: number
  max_success_rate: number
  avg_success_rate: number
}

// 报告类型
export interface Report {
  id?: number
  caseId?: string
  name?: string
  projectId?: string
  directoryId?: string
  projectName?: string
  status?: string
  duration?: number
  nlp?: string
  url?: string
  yamlFlow?: string
  result?: string
  error?: string
  logs?: string
  createdAt?: string
}

// AI配置
export interface AIConfig {
  baseUrl: string
  apiKey: string
  modelName: string
  modelFamily: string
  browserMode: 'headless' | 'headful'
}

// Flow步骤类型（Midscene 全量 action 类型）
export type FlowStepType =
  | 'ai'        // AI 自动规划（通用）
  | 'aiAct'     // AI 交互（ai 的别名）
  | 'aiTap'     // 点击元素
  | 'aiInput'   // 输入文本
  | 'aiHover'   // 鼠标悬停
  | 'aiScroll'  // 滚动页面
  | 'aiKeyboardPress' // 按键
  | 'aiAssert'  // 断言
  | 'aiWaitFor' // 等待条件
  | 'aiQuery'   // 数据提取
  | 'sleep'     // 固定等待
  | 'javascript' // 执行 JS
  | 'recordToReport' // 记录截图

// Flow步骤
export interface FlowStep {
  type: FlowStepType
  index?: number

  // === 通用 ===
  instruction?: string       // prompt（ai / aiTap / aiInput / aiAssert）

  // === ai ===
  deepThink?: boolean        // 引导深度任务拆解

  // === aiInput ===
  value?: string             // 输入框最终文本内容

  // === sleep ===
  duration?: number          // 等待毫秒数

  // === aiAssert ===
  errorMessage?: string      // 断言失败时的错误信息
  name?: string              // 输出 JSON 中的 key 名称
}

// 单个 Task 定义
export interface TaskItem {
  name: string
  flow: FlowStep[]
  collapsed?: boolean
  continueOnError?: boolean
}

// YAML配置
export interface YamlConfig {
  type: 'web' | 'task' | 'flow'
  url?: string
  timeout?: number
  tasks?: TaskItem[]
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 批量执行进度 - 单个用例状态
export interface BatchCaseStatus {
  caseId: string
  caseName: string
  executionId: string
  status: 'RUNNING' | 'SUCCESS' | 'FAILED'
}

// 批量执行进度响应
export interface BatchProgress {
  batchId: string
  projectId: string
  projectName: string
  total: number
  completed: number
  success: number
  failed: number
  running: number
  status: 'RUNNING' | 'COMPLETED'
  cases: BatchCaseStatus[]
  mergedReportUrl?: string
}

// 批量执行响应
export interface BatchExecuteResult {
  batchId: string
  total: number
  message: string
}

// 用户信息类型
export interface User {
  id: number
  username: string
  password?: string
  displayName: string
  role: 'sysadmin' | 'general'
  status: number
  lastLoginAt?: string
  createdAt?: string
}

// 路由元信息
export interface RouteMeta {
  title: string
  icon?: string
  requiresAuth?: boolean
  role?: string
}
