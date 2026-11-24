import request from './axios'

// 获取图形验证码（免鉴权）：{ key, image }，image 为 PNG base64 data URI
export interface CaptchaInfo { key: string; image: string }
export const getCaptcha = () => {
  return request.get<CaptchaInfo>('/platform/auth/captcha')
}

// 登录（带验证码时后端强校验；插件等客户端可省略验证码字段）
export const login = (username: string, password: string, captchaKey?: string, captchaCode?: string) => {
  return request.post('/platform/auth/login', { username, password, captchaKey, captchaCode })
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
