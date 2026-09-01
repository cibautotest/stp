import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import router from '@/router'
import { login as apiLogin, logout as apiLogout, getCurrentUser, updateMySettings as apiUpdateMySettings, changeMyPassword as apiChangeMyPassword } from '@/api'

export interface UserInfo {
  id: number
  username: string
  displayName: string
  role: 'sysadmin' | 'general'
  status: number
  executeServiceUrl?: string
  createdAt?: string
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref('')
  const user = ref<UserInfo | null>(null)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isSysadmin = computed(() => user.value?.role === 'sysadmin')

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const res: any = await apiLogin(username, password)
      token.value = res.token || ''
      user.value = res.user
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  async function logout() {
    try {
      await apiLogout()
    } catch {
      // The local session is cleared even when the server is unavailable.
    }
    token.value = ''
    user.value = null
    router.push('/login')
  }

  async function init() {
    try {
      const userInfo: any = await getCurrentUser()
      user.value = userInfo
    } catch (error) {
      token.value = ''
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function updateMySettings(data: { displayName?: string; executeServiceUrl?: string }) {
    const userInfo: any = await apiUpdateMySettings(data)
    user.value = userInfo
    return userInfo
  }

  async function changeMyPassword(data: { oldPassword: string; newPassword: string }) {
    return apiChangeMyPassword(data)
  }

  return {
    token,
    user,
    initialized,
    isAuthenticated,
    isSysadmin,
    login,
    logout,
    init,
    updateMySettings,
    changeMyPassword
  }
})
