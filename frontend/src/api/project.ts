import request from './axios'
import type { ApiResponse, Project, PageResult } from '@/types'

// 分页查询项目列表（支持按名称模糊搜索）
export const getProjects = (params?: { name?: string; page?: number; size?: number }) => {
  return request.get<PageResult<Project>>('/platform/projects', { params })
}

// 获取项目详情
export const getProjectById = (id: string) => {
  return request.get<Project>(`/platform/projects/${id}`)
}

// 创建项目
export const createProject = (data: Project) => {
  return request.post<Project>('/platform/projects', data)
}

// 更新项目
export const updateProject = (id: string, data: Project) => {
  return request.put<Project>(`/platform/projects/${id}`, data)
}

// 删除项目
export const deleteProject = (id: string) => {
  return request.delete<ApiResponse>(`/platform/projects/${id}`)
}
