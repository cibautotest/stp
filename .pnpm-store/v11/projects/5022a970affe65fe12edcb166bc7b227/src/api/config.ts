import request from './axios'

// 获取AI配置 - 后端端点：GET /api/config
export const getAIConfig = () => {
  return request.get<any>('/config')
}

// 保存AI配置 - 后端端点：POST /api/config
export const saveAIConfig = (data: {
  baseUrl: string
  apiKey: string
  modelName: string
  modelFamily: string
  browserHeadless: boolean
}) => {
  return request.post<{ success: boolean }>('/config', data)
}
