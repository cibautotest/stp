import request from './axios'

// 登录
export const login = (username: string, password: string) => {
  return request.post('/platform/auth/login', { username, password })
}

export const logout = () => {
  return request.post('/platform/auth/logout')
}

// 获取当前用户信息
export const getCurrentUser = () => {
  return request.get('/platform/auth/me')
}

export const updateMySettings = (data: { displayName?: string; executeServiceUrl?: string }) => {
  return request.put('/platform/auth/me/settings', data)
}

export const changeMyPassword = (data: { oldPassword: string; newPassword: string }) => {
  return request.put('/platform/users/me/password', data)
}
