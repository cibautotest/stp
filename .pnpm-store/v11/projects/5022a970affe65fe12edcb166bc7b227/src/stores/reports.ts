import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Report, PageResult } from '@/types'
import { getReports, deleteReport as deleteReportApi } from '@/api'

export const useReportStore = defineStore('reports', () => {
  const reports = ref<Report[]>([])
  const total = ref(0)
  const page = ref(1)
  const size = ref(10)
  const loading = ref(false)
  const projectId = ref<string>('')

  const fetchReports = async (params?: { page?: number; size?: number; projectId?: string; directoryId?: string }) => {
    loading.value = true
    try {
      if (params) {
        if (params.page !== undefined) page.value = params.page
        if (params.size !== undefined) size.value = params.size
        if (params.projectId !== undefined) projectId.value = params.projectId
      }
      const query: Record<string, any> = { page: page.value, size: size.value }
      if (projectId.value) {
        query.projectId = projectId.value
      }
      if (params?.directoryId) query.directoryId = params.directoryId
      const res = await getReports(query)
      const data = res as PageResult<Report>
      reports.value = data.items || []
      total.value = data.total || 0
    } catch (error) {
      console.error('获取报告列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  const removeReport = async (id: number) => {
    try {
      await deleteReportApi(id)
      await fetchReports()
      return true
    } catch (error) {
      console.error('删除报告失败:', error)
      return false
    }
  }

  return {
    reports,
    total,
    page,
    size,
    loading,
    projectId,
    fetchReports,
    removeReport
  }
})
