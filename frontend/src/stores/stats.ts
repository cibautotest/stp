import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AIConfig } from '@/types'
import { getAIConfig, saveAIConfig } from '@/api'

export const useConfigStore = defineStore('config', () => {
  const aiConfig = ref<AIConfig>({
    baseUrl: '',
    apiKey: '',
    modelName: '',
    modelFamily: '',
    browserMode: 'headless'
  })
  const loading = ref(false)

  const fetchAIConfig = async () => {
    loading.value = true
    try {
      const res = await getAIConfig()
      if (res) {
        aiConfig.value = {
          baseUrl: (res as any).baseUrl || '',
          apiKey: (res as any).apiKey || '',
          modelName: (res as any).modelName || '',
          modelFamily: (res as any).modelFamily || '',
          browserMode: (res as any).browserHeadless === false ? 'headful' : 'headless'
        }
      }
    } catch (error) {
      console.error('获取配置失败:', error)
    } finally {
      loading.value = false
    }
  }

  const updateAIConfig = async (config: AIConfig) => {
    try {
      await saveAIConfig({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        modelFamily: config.modelFamily,
        browserHeadless: config.browserMode === 'headless'
      })
      aiConfig.value = { ...config }
      return true
    } catch (error) {
      console.error('保存配置失败:', error)
      return false
    }
  }

  const updateBrowserMode = async (mode: 'headless' | 'headful') => {
    try {
      const config = { ...aiConfig.value, browserMode: mode }
      await saveAIConfig({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelName: config.modelName,
        modelFamily: config.modelFamily,
        browserHeadless: mode === 'headless'
      })
      aiConfig.value = { ...config, browserMode: mode }
      return true
    } catch (error) {
      console.error('保存浏览器模式失败:', error)
      return false
    }
  }

  return {
    aiConfig,
    loading,
    fetchAIConfig,
    updateAIConfig,
    updateBrowserMode
  }
})
