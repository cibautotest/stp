import request from './axios'

export interface TestPlan {
  id: string
  projectId: string
  name: string
  description?: string
  status: string
  createdBy?: number
  createdAt?: string
  updatedAt?: string
  lastExecutedAt?: string
  lastExecutionResult?: string
  lastBatchId?: string
}

/**
 * 获取测试计划列表（支持按项目筛选）
 */
export function getPlans(projectId?: string) {
  const params: Record<string, string> = {}
  if (projectId) params.projectId = projectId
  return request.get<TestPlan[]>('/platform/plans', { params })
}

/**
 * 获取计划详情
 */
export function getPlanById(id: string) {
  return request.get<TestPlan>(`/platform/plans/${id}`)
}

/**
 * 创建测试计划
 */
export function createPlan(data: {
  name: string
  projectId: string
  description?: string
  caseIds?: string[]
}) {
  return request.post<TestPlan>('/platform/plans', data)
}

/**
 * 更新测试计划
 */
export function updatePlan(id: string, data: Partial<TestPlan>) {
  return request.put<TestPlan>(`/platform/plans/${id}`, data)
}

/**
 * 删除测试计划
 */
export function deletePlan(id: string) {
  return request.delete(`/platform/plans/${id}`)
}

/**
 * 获取计划内的用例列表
 */
export function getPlanCases(planId: string) {
  return request.get<any[]>(`/platform/plans/${planId}/cases`)
}

/**
 * 向计划添加用例
 */
export function addCasesToPlan(planId: string, caseIds: string[]) {
  return request.post(`/platform/plans/${planId}/cases`, { caseIds })
}

/**
 * 从计划移除用例
 */
export function removeCaseFromPlan(planId: string, caseId: string) {
  return request.delete(`/platform/plans/${planId}/cases/${caseId}`)
}

/** 执行计划返回 */
export interface PlanExecuteResult {
  batchId: string
  totalCases: number
  message: string
}

/**
 * 执行测试计划（串行执行所有用例）
 */
export function executePlan(planId: string) {
  return request.post<PlanExecuteResult>(`/platform/plans/${planId}/execute`)
}
