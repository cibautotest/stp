<template>
  <div class="profile-view">
    <div class="settings-panel">
      <div class="panel-header">
        <div>
          <h2>个人设置</h2>
          <p>配置当前账号自己的执行参数。</p>
        </div>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        class="settings-form"
      >
        <el-form-item label="用户名">
          <el-input :model-value="authStore.user?.username || ''" disabled />
        </el-form-item>
        <el-form-item label="显示名称" prop="displayName">
          <el-input v-model="form.displayName" maxlength="64" show-word-limit />
        </el-form-item>
        <el-form-item label="执行机地址" prop="executeServiceUrl">
          <el-input
            v-model="form.executeServiceUrl"
            placeholder="http://execute.example.com:3001"
            clearable
          />
          <div class="field-hint">配置后优先使用该地址；留空时使用项目设置里的执行机地址。</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="saveSettings">
            <el-icon><Check /></el-icon>
            保存
          </el-button>
          <el-button @click="resetForm">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <div class="password-panel">
        <h3>修改密码</h3>
        <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="120px" class="password-form">
          <el-form-item label="当前密码" prop="oldPassword">
            <el-input v-model="passwordForm.oldPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="新密码" prop="newPassword">
            <el-input v-model="passwordForm.newPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="changingPassword" @click="changePassword">
              <el-icon><Key /></el-icon>
              修改密码
            </el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Check, RefreshLeft, Key } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const formRef = ref()
const passwordFormRef = ref()
const saving = ref(false)
const changingPassword = ref(false)

const form = reactive({
  displayName: '',
  executeServiceUrl: ''
})

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const rules = {
  displayName: [
    { required: true, message: '请输入显示名称', trigger: 'blur' },
    { max: 64, message: '显示名称不能超过 64 个字符', trigger: 'blur' }
  ],
  executeServiceUrl: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        const trimmed = (value || '').trim()
        if (!trimmed) {
          callback()
          return
        }
        try {
          const url = new URL(trimmed)
          if (!['http:', 'https:'].includes(url.protocol)) {
            callback(new Error('执行机地址必须以 http:// 或 https:// 开头'))
            return
          }
          callback()
        } catch {
          callback(new Error('请输入合法的执行机地址'))
        }
      },
      trigger: 'blur'
    }
  ]
}

const passwordRules = {
  oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 个字符', trigger: 'blur' }
  ],
  confirmPassword: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const resetForm = () => {
  form.displayName = authStore.user?.displayName || authStore.user?.username || ''
  form.executeServiceUrl = authStore.user?.executeServiceUrl || ''
}

const saveSettings = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      await authStore.updateMySettings({
        displayName: form.displayName.trim(),
        executeServiceUrl: form.executeServiceUrl.trim()
      })
      resetForm()
      ElMessage.success('个人设置已保存')
    } catch (error: any) {
      ElMessage.error(error?.message || '保存失败')
    } finally {
      saving.value = false
    }
  })
}

const changePassword = async () => {
  if (!passwordFormRef.value) return
  await passwordFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    changingPassword.value = true
    try {
      await authStore.changeMyPassword({
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      })
      passwordForm.oldPassword = ''
      passwordForm.newPassword = ''
      passwordForm.confirmPassword = ''
      ElMessage.success('密码已更新')
    } catch (error: any) {
      ElMessage.error(error?.response?.data?.error || error?.message || '修改密码失败')
    } finally {
      changingPassword.value = false
    }
  })
}

onMounted(resetForm)
</script>

<style lang="scss" scoped>
.profile-view {
  max-width: 760px;
}

.settings-panel {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding-bottom: 18px;
  margin-bottom: 22px;
  border-bottom: 1px solid #ebeef5;

  h2 {
    margin: 0 0 8px;
    font-size: 20px;
    color: #303133;
  }

  p {
    margin: 0;
    color: #909399;
    line-height: 1.5;
  }
}

.settings-form {
  max-width: 640px;
}

.password-panel {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;

  h3 {
    margin: 0 0 16px;
    font-size: 18px;
    color: #303133;
  }
}

.password-form {
  max-width: 640px;
}

.field-hint {
  margin-top: 6px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
</style>
