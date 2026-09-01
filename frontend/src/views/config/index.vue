<template>
  <div class="config-view">
    <el-row :gutter="20">
      <!-- 参数配置 -->
      <el-col :span="16">
        <div class="config-card">
          <h3 class="card-title">
            <el-icon><Cpu /></el-icon>
            AI配置
          </h3>
          <el-form
            ref="formRef"
            :model="formData"
            label-width="120px"
            class="config-form"
          >
            <el-form-item label="Base URL" prop="baseUrl">
              <template #label>
                <span>
                  Base URL
                  <el-tooltip content="Base URL 是 API 的基础地址，通常由模型提供商提供" placement="top">
                    <el-icon class="tip-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input
                v-model="formData.baseUrl"
                placeholder="例如: https://api.openai.com/v1"
              />
            </el-form-item>
            <el-form-item label="API Key" prop="apiKey">
              <template #label>
                <span>
                  API Key
                  <el-tooltip content="API Key 是访问 AI 服务的凭证，请妥善保管" placement="top">
                    <el-icon class="tip-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input
                v-model="formData.apiKey"
                type="password"
                show-password
                placeholder="输入API Key"
              />
            </el-form-item>
            <el-form-item label="模型名称" prop="modelName">
              <template #label>
                <span>
                  模型名称
                  <el-tooltip content="指定 AI 模型的名称，请根据模型提供商文档填写" placement="top">
                    <el-icon class="tip-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-input
                v-model="formData.modelName"
                placeholder="例如: gpt-4, gpt-3.5-turbo"
              />
            </el-form-item>
            <el-form-item label="模型家族" prop="modelFamily">
              <template #label>
                <span>
                  模型家族
                  <el-tooltip content="选择模型所属的家族，不同家族模型特性不同" placement="top">
                    <el-icon class="tip-icon"><InfoFilled /></el-icon>
                  </el-tooltip>
                </span>
              </template>
              <el-select v-model="formData.modelFamily" placeholder="选择模型家族" class="full-width">
                <el-option label="GPT" value="gpt" />
                <el-option label="Claude" value="claude" />
                <el-option label="Gemini" value="gemini" />
                <el-option label="其他" value="other" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="handleSave">
                <el-icon><Check /></el-icon>
                保存配置
              </el-button>
              <el-button @click="handleReset">
                <el-icon><RefreshLeft /></el-icon>
                重置
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-col>

      <!-- 浏览器模式 -->
      <el-col :span="8">
        <div class="config-card">
          <h3 class="card-title">
            <el-icon><Monitor /></el-icon>
            浏览器模式
            <el-tooltip content="Headless 适合自动化测试执行更快，Headful 适合调试可观察浏览器操作" placement="top">
              <el-icon class="tip-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </h3>
          <div class="browser-mode">
            <el-radio-group v-model="browserMode" class="mode-group">
              <el-radio-button label="headless" class="mode-btn">
                <div class="mode-option">
                  <el-icon class="mode-icon"><Monitor /></el-icon>
                  <div class="mode-info">
                    <span class="mode-name">Headless</span>
                    <span class="mode-desc">无头模式，不显示窗口</span>
                  </div>
                </div>
              </el-radio-button>
              <el-radio-button label="headful" class="mode-btn">
                <div class="mode-option">
                  <el-icon class="mode-icon"><View /></el-icon>
                  <div class="mode-info">
                    <span class="mode-name">Headful</span>
                    <span class="mode-desc">有头模式，显示窗口</span>
                  </div>
                </div>
              </el-radio-button>
            </el-radio-group>
            <el-button
              type="primary"
              :loading="savingBrowser"
              class="save-mode-btn"
              @click="handleSaveBrowserMode"
            >
              保存模式
            </el-button>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Cpu, Monitor, View, Check, RefreshLeft, InfoFilled } from '@element-plus/icons-vue'
import { useConfigStore } from '@/stores'

const configStore = useConfigStore()

// 表单数据
const formData = reactive({
  baseUrl: '',
  apiKey: '',
  modelName: '',
  modelFamily: ''
})

// 浏览器模式
const browserMode = ref<'headless' | 'headful'>('headless')

// 状态
const saving = ref(false)
const savingBrowser = ref(false)
const formRef = ref()

// 加载配置
const loadConfig = async () => {
  await configStore.fetchAIConfig()
  const config = configStore.aiConfig

  formData.baseUrl = config.baseUrl || ''
  formData.apiKey = config.apiKey || ''
  formData.modelName = config.modelName || ''
  formData.modelFamily = config.modelFamily || ''
  browserMode.value = config.browserMode || 'headless'
}

// 保存AI配置
const handleSave = async () => {
  saving.value = true
  try {
    const success = await configStore.updateAIConfig({
      ...formData,
      browserMode: browserMode.value
    })
    if (success) {
      ElMessage.success('配置保存成功')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 保存浏览器模式
const handleSaveBrowserMode = async () => {
  savingBrowser.value = true
  try {
    const success = await configStore.updateBrowserMode(browserMode.value)
    if (success) {
      ElMessage.success('浏览器模式保存成功')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    savingBrowser.value = false
  }
}

// 重置
const handleReset = () => {
  formData.baseUrl = ''
  formData.apiKey = ''
  formData.modelName = ''
  formData.modelFamily = ''
}

// 初始化
onMounted(() => {
  loadConfig()
})
</script>

<style lang="scss" scoped>
.config-view {
  :deep(.el-row) {
    display: flex;
    flex-wrap: wrap;
    .el-col { display: flex; }
  }
  .config-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #fff;
    border-radius: 8px;
    padding: 24px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

    &.mt-20 {
      margin-top: 20px;
    }

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
      font-weight: 600;
      color: #303133;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #409eff;

      .el-icon {
        color: #409eff;
      }

      .tip-icon {
        color: #409eff;
        cursor: help;
        font-size: 16px;
      }
    }

    .config-form {
      :deep(.el-form-item__label) {
        font-weight: 500;
      }

      .full-width {
        width: 100%;
      }

      .tip-icon {
        color: #409eff;
        margin-left: 4px;
        cursor: help;
        font-size: 14px;
      }
    }

    .browser-mode {
      display: flex;
      flex-direction: column;
      height: 100%;

      .mode-group {
        display: flex;
        flex-direction: column;
        gap: 16px;
        width: 100%;
        flex: 1;
        padding: 4px 0;

        :deep(.el-radio-button) {
          width: 100%;

          .el-radio-button__inner {
            padding: 20px;
            border: 2px solid #e8ecf1;
            border-radius: 12px !important;
            width: 100%;
            height: auto;
            display: flex;
            align-items: center;
            transition: all 0.3s ease;
            background: #fff;
            box-shadow: 0 1px 4px rgba(0,0,0,0.02);

            &:hover {
              border-color: #409eff;
              box-shadow: 0 4px 16px rgba(64,158,255,0.1);
              transform: translateY(-1px);
            }
          }

          &.is-active .el-radio-button__inner {
            border-color: #409eff;
            background: linear-gradient(135deg, #f0f7ff 0%, #e3f0ff 100%);
            box-shadow: 0 4px 20px rgba(64,158,255,0.18);
            transform: translateY(-1px);
          }
        }

        .mode-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 2px 0;
          width: 100%;

          .mode-icon {
            font-size: 36px;
            color: #409eff;
            flex-shrink: 0;
            background: rgba(64,158,255,0.08);
            padding: 8px;
            border-radius: 10px;
          }

          .mode-info {
            display: flex;
            flex-direction: column;
            gap: 6px;

            .mode-name {
              font-weight: 700;
              font-size: 17px;
              color: #1a1a2e;
            }

            .mode-desc {
              font-size: 13px;
              color: #909399;
              line-height: 1.4;
            }
          }
        }
      }

      .save-mode-btn {
        margin-top: 16px;
        width: 100%;
        height: 44px;
        font-size: 15px;
        font-weight: 500;
        border-radius: 10px;
      }
    }


  }
}
</style>
