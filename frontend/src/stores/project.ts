import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@/types'
import { getProjects, createProject, deleteProject } from '@/api'
import { useCaseStore } from './cases'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const loading = ref(false)
  const currentProject = ref<Project | null>(null)
  const total = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(10)

  // 获取项目列表（分页 + 名称搜索）
  const fetchProjects = async (params?: { name?: string; page?: number; size?: number }) => {
    loading.value = true
    try {
      const res = await getProjects(params)
      const data = res as any
      // 处理分页响应
      if (data && data.items) {
        projects.value = data.items
        total.value = data.total || 0
        currentPage.value = data.page || 1
        pageSize.value = data.size || 10
      } else if (Array.isArray(data)) {
        // 兼容旧格式
        projects.value = data
      } else if (data && data.data) {
        // axios 包裹了一层 data
        const inner = data.data
        if (inner && inner.items) {
          projects.value = inner.items
          total.value = inner.total || 0
          currentPage.value = inner.page || 1
          pageSize.value = inner.size || 10
        } else if (Array.isArray(inner)) {
          projects.value = inner
        }
      }
      const savedId = localStorage.getItem('currentProjectId')
      if (savedId) currentProject.value = projects.value.find(p => p.id === savedId) || null
      if (!currentProject.value && projects.value.length) currentProject.value = projects.value[0]
    } catch (error) {
      console.error('获取项目列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 全量获取（用于下拉选择等场景，不分页）
  const fetchAllProjects = async () => {
    loading.value = true
    try {
      const res = await getProjects({ size: 9999 })
      const data = res as any
      if (data && data.items) {
        projects.value = data.items
      } else if (Array.isArray(data)) {
        projects.value = data
      } else if (data && data.data && data.data.items) {
        projects.value = data.data.items
      }
    } catch (error) {
      console.error('获取项目列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 创建项目
  const addProject = async (name: string, description?: string) => {
    try {
      const res = await createProject({ name, description })
      const data = res as any
      const newProject = data?.data || data
      if (newProject && newProject.id) {
        projects.value.unshift(newProject)
      } else {
        await fetchProjects()
      }
      return newProject || null
    } catch (error) {
      console.error('创建项目失败:', error)
    }
    return null
  }

  // 删除项目
  const removeProject = async (id: string) => {
    try {
      await deleteProject(id)
      projects.value = projects.value.filter(p => p.id !== id)
      return true
    } catch (error) {
      console.error('删除项目失败:', error)
      return false
    }
  }

  // 选择项目
  const selectProject = (project: Project | null) => {
    currentProject.value = project
    if (project?.id) localStorage.setItem('currentProjectId', project.id)
    else localStorage.removeItem('currentProjectId')
  }

  return {
    projects,
    loading,
    currentProject,
    total,
    currentPage,
    pageSize,
    fetchProjects,
    fetchAllProjects,
    addProject,
    removeProject,
    selectProject
  }
})
