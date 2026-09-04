import request from './axios'
import type { TestCase, BatchExecuteResult, BatchProgress } from '@/types'

// 获取所有用例 - 后端直接返回数组
export const getCases = () => {
  return request.get<TestCase[]>('/platform/cases')
}

export interface CaseDirectory { id: string; projectId: string; parentId?: string; name: string }
export const getCaseDirectories = (projectId: string) => request.get<CaseDirectory[]>('/platform/case-directories', { params: { projectId } })
export const createCaseDirectory = (data: { projectId: string; parentId?: string; name: string }) => request.post<CaseDirectory>('/platform/case-directories', data)
export const deleteCaseDirectory = (id: string) => request.delete(`/platform/case-directories/${encodeURIComponent(id)}`)

// ── 登录方式（按项目维度，跨用例复用） ──
export type LoginMethodType = 'none' | 'cas' | 'local'
export interface LoginMethod {
  id: string
  projectId: string
  name: string
  type: LoginMethodType
  loginUrl?: string
  roleName?: string
  username?: string
  password?: string
  stepsNlp?: string
  yamlScript?: string
  cacheStatus?: 'uncached' | 'cached'
}
export const getLoginMethods = (projectId: string) => request.get<LoginMethod[]>('/platform/login-methods', { params: { projectId } })
export const createLoginMethod = (data: Omit<LoginMethod, 'id' | 'cacheStatus'>) => request.post<LoginMethod>('/platform/login-methods', data)
export const updateLoginMethod = (id: string, data: Partial<LoginMethod>) => request.put<LoginMethod>(`/platform/login-methods/${encodeURIComponent(id)}`, data)
export const deleteLoginMethod = (id: string) => request.delete(`/platform/login-methods/${encodeURIComponent(id)}`)

// 创建用例 - 与后端 TestCase 实体匹配
export const createCase = (data: {
  projectId: string
  directoryId: string
  loginMethodId?: string
  name: string
  description?: string
  nlp: string
  yamlFlow?: string
  aiConfig?: any
}) => {
  return request.post<TestCase>('/platform/cases', data)
}

// 更新用例 - 后端不支持，保留接口
export const updateCase = (id: string, data: Partial<TestCase>) => {
  return request.put<TestCase>(`/platform/cases/${encodeURIComponent(id)}`, data)
}

// 删除用例
export const deleteCase = (id: string) => {
  return request.delete<{ success: boolean }>(`/platform/cases/${encodeURIComponent(id)}`)
}

// 执行已有用例 - 调用 POST /api/platform/execute/cases/{id}
export type ExecutionMode = 'NLP' | 'YAML'
export const executeCase = (id: string, customYaml?: string, headless?: boolean, executionMode: ExecutionMode = 'NLP') => {
  return request.post<{ caseId: string; executionId: string }>(`/platform/execute/cases/${encodeURIComponent(id)}`, {
    customYaml: customYaml || '',
    headless,
    executionMode
  })
}

// 获取单个用例
export const getCase = (id: string) => {
  return request.get<TestCase>(`/platform/cases/${encodeURIComponent(id)}`)
}
export const getCaseCache = (id: string) => request.get<string>(`/platform/cases/${encodeURIComponent(id)}/cache`, { responseType: 'text' })

// 创建用例并异步执行
export const createAndExecute = (data: {
  projectId: string
  directoryId: string
  loginMethodId?: string
  name: string
  description?: string
  nlp: string
  customYaml?: string
  headless?: boolean
  executionMode?: ExecutionMode
}) => {
  return request.post<{ caseId: string; executionId: string | null; success: boolean; error?: string }>('/platform/execute/create-and-execute', data)
}

// 调试当前草稿：仅执行，不创建测试用例。
export const debugExecute = (data: { projectId: string; name?: string; nlp: string; yamlScript?: string; headless?: boolean; executionMode?: ExecutionMode }) => {
  return request.post<{ executionId: string; status: string }>('/platform/execute/debug', data)
}
export const cancelDebugExecute = (executionId: string) => request.post(`/platform/execute/debug/${encodeURIComponent(executionId)}/cancel`)

// 批量执行用例
export const batchExecuteCases = (caseIds: string[]) => {
  return request.post<BatchExecuteResult>('/platform/execute/batch', { caseIds })
}

// 查询批量执行进度
export const getBatchProgress = (batchId: string) => {
  return request.get<BatchProgress>(`/platform/execute/batch/${batchId}/progress`)
}

// NLP → Action 步骤拆解
export interface ActionStep {
  type: string
  prompt: string
  value?: string
}
export const nlpToActions = (nlp: string) => {
  return request.post<ActionStep[]>('/platform/cases/nlp-to-actions', { nlp })
}

export const streamNlpToYaml = async (
  nlp: string,
  onChunk: (chunk: string) => void,
  onReasoning?: (chunk: string) => void
): Promise<string> => {
  const response = await fetch('/api/platform/cases/nlp-to-yaml/stream', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nlp })
  })
  if (!response.ok || !response.body) throw new Error(await response.text() || '脚本生成请求失败')
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let complete = ''
  while (true) {
    const { value, done } = await reader.read(); buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() || ''
    for (const event of events) { const name = event.match(/^event:\s*(.+)$/m)?.[1]; const data = event.match(/^data:\s*([\s\S]*)$/m)?.[1] || ''; if (name === 'chunk') onChunk(data); else if (name === 'reasoning') onReasoning?.(data); else if (name === 'complete') complete = data; else if (name === 'error') throw new Error(data) }
    if (done) break
  }
  return complete
}
