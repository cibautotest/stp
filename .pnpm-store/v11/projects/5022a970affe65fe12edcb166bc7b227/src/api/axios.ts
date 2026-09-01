import axios from 'axios'
import { ElMessage, ElNotification } from 'element-plus'
import router from '@/router'

// 创建 axios 实例
const service = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器 — 自动添加 JWT Token
service.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response) => {
    const res = response.data
    if (res.success === false) {
      ElMessage.error(res.message || res.error || '请求失败')
      return Promise.reject(new Error(res.message || res.error))
    }
    return res
  },
  (error) => {
    const apiError = error.response?.data?.error || error.response?.data?.message || error.message || ''
    if (apiError.includes('未配置执行机')) {
      ElNotification({
        title: '未配置执行机',
        message: '当前用户和项目均未配置执行机地址，无法执行。请前往“项目设置”配置项目执行机，或联系管理员在“用户管理”中配置用户执行机。',
        type: 'error',
        duration: 0,
        position: 'top-right'
      })
      return Promise.reject(error)
    }
    if (error.response) {
      switch (error.response.status) {
        case 401:
          ElMessage.error('未授权，请重新登录')
          router.push('/login')
          break
        case 403:
          ElMessage.error('拒绝访问')
          break
        case 404:
          ElMessage.error('请求的资源不存在')
          break
        case 500:
          ElMessage.error('服务器错误')
          break
        default:
          ElMessage.error(error.message || '网络错误')
      }
    } else {
      ElMessage.error('网络连接失败')
    }
    return Promise.reject(error)
  }
)

export default service
export { service as request }
