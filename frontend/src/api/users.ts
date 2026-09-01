import request from './axios'
import type { PageResult } from '@/types'

// 用户信息类型
export interface UserVO {
  id: number
  username: string
  password?: string
  displayName: string
  role: 'sysadmin' | 'general'
  status: number
  executeServiceUrl?: string
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

// 分页查询用户列表
export const getUsers = (params?: { page?: number; size?: number; username?: string }) => {
  return request.get<PageResult<UserVO>>('/platform/users', { params })
}

// 获取用户详情
export const getUserById = (id: number) => {
  return request.get<UserVO>(`/platform/users/${id}`)
}

// 创建用户
export const createUser = (data: { username: string; password: string; displayName?: string; role?: string; status?: number; executeServiceUrl?: string }) => {
  return request.post<UserVO>('/platform/users', data)
}

// 更新用户
export const updateUser = (id: number, data: { displayName?: string; role?: string; status?: number; executeServiceUrl?: string }) => {
  return request.put<UserVO>(`/platform/users/${id}`, data)
}

// 重置密码
export const resetPassword = (id: number, password: string) => {
  return request.put(`/platform/users/${id}/password`, { password })
}

// 删除用户
export const deleteUser = (id: number) => {
  return request.delete(`/platform/users/${id}`)
}

// 获取用户项目权限
export const getUserProjects = (id: number) => {
  return request.get<{ projectIds: string[] }>(`/platform/users/${id}/projects`)
}

// 分配用户项目权限
export const assignUserProjects = (id: number, projectIds: string[]) => {
  return request.put(`/platform/users/${id}/projects`, { projectIds })
}

// 获取所有项目（用于权限分配选择器）
export const getAllProjects = () => {
  return request.get('/platform/users/all-projects')
}
