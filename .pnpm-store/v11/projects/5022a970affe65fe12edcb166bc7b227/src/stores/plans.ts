import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getPlans, createPlan, deletePlan, updatePlan, getPlanCases, addCasesToPlan, removeCaseFromPlan, executePlan } from '@/api/plans'
import type { TestPlan, PlanExecuteResult } from '@/api/plans'

export const usePlanStore = defineStore('plan', () => {
  const plans = ref<TestPlan[]>([])
  const loading = ref(false)

  /** 当前正在执行的 batchId → planId 映射 */
  const executingBatches = ref<Record<string, string>>({})

  async function fetchPlans(projectId?: string) {
    loading.value = true
    try {
      const res = await getPlans(projectId)
      plans.value = Array.isArray(res) ? res : []
    } catch {
      plans.value = []
    } finally {
      loading.value = false
    }
  }

  async function addPlan(data: { name: string; projectId: string; description?: string; caseIds?: string[] }) {
    const res = await createPlan(data)
    const plan = res || data as any
    plans.value.unshift(plan)
    return plan
  }

  async function removePlan(id: string) {
    await deletePlan(id)
    plans.value = plans.value.filter(p => p.id !== id)
  }

  async function editPlan(id: string, data: Partial<TestPlan>) {
    const res = await updatePlan(id, data)
    const plan = res || data as any
    const idx = plans.value.findIndex(p => p.id === id)
    if (idx !== -1) plans.value[idx] = plan
    return plan
  }

  async function fetchPlanCases(planId: string) {
    const res = await getPlanCases(planId)
    return Array.isArray(res) ? res : []
  }

  async function addCases(planId: string, caseIds: string[]) {
    const res = await addCasesToPlan(planId, caseIds)
    return res
  }

  async function removeCase(planId: string, caseId: string) {
    await removeCaseFromPlan(planId, caseId)
  }

  /**
   * 执行测试计划
   * @returns batchId 或 null（执行失败时）
   */
  async function runPlan(planId: string): Promise<PlanExecuteResult | null> {
    try {
      const res = await executePlan(planId)
      if (res) {
        executingBatches.value[planId] = res.batchId
      }
      return res ?? null
    } catch {
      return null
    }
  }

  /** 标记计划执行完成 */
  function markExecutionComplete(planId: string) {
    delete executingBatches.value[planId]
  }

  /** 是否正在执行中 */
  function isExecuting(planId: string): boolean {
    return !!executingBatches.value[planId]
  }

  return {
    plans,
    loading,
    executingBatches,
    fetchPlans,
    addPlan,
    removePlan,
    editPlan,
    fetchPlanCases,
    addCases,
    removeCase,
    runPlan,
    markExecutionComplete,
    isExecuting
  }
})
