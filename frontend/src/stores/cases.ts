import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { TestCase } from '@/types'
import { getCases, createCase, deleteCase, executeCase, createAndExecute, request, type ExecutionMode } from '@/api'

export type CaseStatus = 'all' | 'SUCCESS' | 'FAILED' | 'RUNNING' | 'PENDING'

export const useCaseStore = defineStore('cases', () => {
  const cases = ref<TestCase[]>([])
  const loading = ref(false)
  const statusFilter = ref<CaseStatus>('all')
  const projectFilter = ref<string | null>(null)
  const collapsedProjects = ref<Set<string>>(new Set())

  // 按项目分组的用例
  const groupedCases = computed(() => {
    const grouped: Record<string, TestCase[]> = {}
    cases.value.forEach(c => {
      const pid = (c as any).project || '默认项目'
      if (!grouped[pid]) grouped[pid] = []
      grouped[pid].push(c)
    })
    return grouped
  })

  // 按状态筛选
  const filteredCases = computed(() => {
    let result = cases.value
    if (projectFilter.value !== null) {
      result = result.filter(c => (c as any).project === projectFilter.value)
    }
    if (statusFilter.value !== 'all') {
      result = result.filter(c => c.status === statusFilter.value)
    }
    return result
  })

  // 获取所有用例
  const fetchCases = async () => {
    loading.value = true
    try {
      const res = await getCases()
      // 后端直接返回数组，响应拦截器已返回 response.data
      cases.value = res || []
    } catch (error) {
      console.error('获取用例列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 创建用例 - 与后端 TestCase 实体匹配
  const addCase = async (data: {
    projectId: string
    directoryId: string
    name: string
    description?: string
    nlp: string
    yamlFlow?: string
    aiConfig?: any
  }) => {
    try {
      const res = await createCase(data)
      // 后端返回新创建的用例对象
      if (res) {
        cases.value.push(res)
        return res
      }
    } catch (error) {
      console.error('创建用例失败:', error)
    }
    return null
  }

  // 删除用例
  const removeCase = async (id: string) => {
    try {
      await deleteCase(id)
      cases.value = cases.value.filter(c => c.id !== id)
      return true
    } catch (error) {
      console.error('删除用例失败:', error)
      return false
    }
  }

  // 执行用例 - 调用 POST /cases/{id}/execute，返回 executionId
  const runCase = async (id: string, customYaml?: string, headless?: boolean, executionMode: ExecutionMode = 'NLP') => {
    try {
      const caseItem = cases.value.find(c => c.id === id)
      if (!caseItem) {
        console.error('用例不存在:', id)
        return null
      }
      const res = await executeCase(id, customYaml, headless, executionMode)
      // 返回 { caseId, executionId }
      return res
    } catch (error) {
      console.error('执行用例失败:', error)
      return { success: false, errorDetail: (error as any).message || '执行失败', logs: [] }
    }
  }

  // 异步执行用例：创建 → 轮询状态 → 回调更新后端
  const runCaseAsync = async (
    data: { projectId: string; directoryId: string; name: string; description?: string; nlp: string; customYaml?: string; headless?: boolean; executionMode?: ExecutionMode },
    onStatusUpdate?: (status: string, reportUrl?: string, queuePosition?: number, errorDetail?: string) => void
  ): Promise<{ caseId: string; executionId: string | null; success: boolean; errorType?: string; errorDetail?: string } | null> => {
    try {
      // 1) 调用后端创建用例并触发异步执行
      const res = await createAndExecute(data)
      const caseId = res.caseId
      const executionId = res.executionId

      // 2) 如果执行提交失败（executionId 为空），直接返回部分成功
      if (!executionId) {
        onStatusUpdate?.('submit_failed', undefined)
        return { caseId, executionId: null, success: false }
      }

      // 3) 通过平台轮询状态。平台会按 execution_record 中保存的地址请求实际执行机。
      const maxPolls = 100
      const pollInterval = 3000 // ms

      for (let i = 0; i < maxPolls; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))

        const statusRes = await request.get<{
          status: string
          reportUrl?: string
          error?: string
          queuePosition?: number
        }>(`/platform/execute/${encodeURIComponent(executionId)}/status`)

        const { status, reportUrl, error, queuePosition } = statusRes

        onStatusUpdate?.(status, reportUrl, queuePosition, error)

        if (status === 'completed') {
          // 4) 回调后端更新 TestCase 记录
          await request.post('/callback/execution-result', {
            caseId,
            executionId,
            status: 'SUCCESS',
            reportUrl: reportUrl || ''
          })
          return { caseId, executionId, success: true }
        }

        if (status === 'failed') {
          await request.post('/callback/execution-result', {
            caseId,
            executionId,
            status: 'FAILED',
            reportUrl: reportUrl || '',
            error: error || 'Execution failed'
          })
          return { caseId, executionId, success: false, errorType: 'execution_failed', errorDetail: error }
        }
      }

      // 超时
      onStatusUpdate?.('failed', undefined, undefined, `执行超时：已等待 ${maxPolls * pollInterval / 1000} 秒（${maxPolls} 次轮询），任务未在预期时间内完成`)
      return { caseId, executionId, success: false, errorType: 'timeout', errorDetail: `执行超时：已等待 ${maxPolls * pollInterval / 1000} 秒（${maxPolls} 次轮询）` }
    } catch (error) {
      console.error('runCaseAsync failed:', error)
      const errMsg = (error as any)?.message || '未知网络错误'
      return { caseId: '', executionId: null, success: false, errorType: 'network_error', errorDetail: `执行状态查询失败：${errMsg}，请检查执行服务是否运行` }
    }
  }

  // 切换项目折叠状态
  const toggleProjectCollapse = (projectName: string) => {
    if (collapsedProjects.value.has(projectName)) {
      collapsedProjects.value.delete(projectName)
    } else {
      collapsedProjects.value.add(projectName)
    }
  }

  // 设置状态筛选
  const setStatusFilter = (status: CaseStatus) => {
    statusFilter.value = status
  }

  // 设置项目筛选
  const setProjectFilter = (projectName: string | null) => {
    projectFilter.value = projectName
  }

  // 获取项目统计信息
  const getProjectStats = (projectName: string) => {
    const projectCases = cases.value.filter(c => (c as any).project === projectName)
    return {
      total: projectCases.length,
      SUCCESS: projectCases.filter(c => c.status === 'SUCCESS').length,
      FAILED: projectCases.filter(c => c.status === 'FAILED').length,
      RUNNING: projectCases.filter(c => c.status === 'RUNNING').length,
      PENDING: projectCases.filter(c => c.status === 'PENDING').length
    }
  }

  return {
    cases,
    loading,
    statusFilter,
    projectFilter,
    collapsedProjects,
    groupedCases,
    filteredCases,
    fetchCases,
    addCase,
    removeCase,
    runCase,
    runCaseAsync,
    toggleProjectCollapse,
    setStatusFilter,
    setProjectFilter,
    getProjectStats
  }
})
