<template>
  <div class="project-settings">
    <div class="toolbar">
      <span class="title">项目设置</span>
      <el-button type="primary" @click="showCreate = true">创建项目</el-button>
    </div>

    <el-card>
      <el-form label-width="130px" style="max-width: 760px">
        <el-form-item label="项目">
          <el-select v-model="projectId" filterable placeholder="请选择项目" class="full-width" @change="selectProject">
            <el-option v-for="project in projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="流量染色注入">
          <el-switch v-model="trafficTaggingEnabled" active-text="开启" inactive-text="关闭" />
          <div class="hint">开启后，该项目执行时会向业务 fetch/XHR 请求注入 SkyWalking SW8 及测试流量标识请求头。</div>
        </el-form-item>

        <el-form-item label="报文发送 Kafka">
          <el-switch v-model="apiExchangeKafkaEnabled" active-text="开启" inactive-text="关闭" />
          <div class="hint">开启后，该项目执行时会采集浏览器 fetch/XHR 请求与响应报文，并由执行机发送到 Kafka。</div>
        </el-form-item>

        <el-form-item label="执行机地址">
          <el-input v-model="executeServiceUrl" placeholder="例如：http://execute.example.com:3001" clearable />
          <div class="hint">该地址作为项目默认配置；用户配置了自己的执行机时会优先使用用户配置。</div>
        </el-form-item>

        <el-form-item label="SkyWalking 地址">
          <el-input v-model="skywalkingGraphqlUrl" placeholder="例如：http://skywalking.example.com:12800/graphql" clearable />
          <div class="hint">用于该项目接口链路图谱查询，需填写 SkyWalking GraphQL endpoint。</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :disabled="!selectedProject" :loading="saving" @click="save">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-dialog v-model="showCreate" title="创建项目" width="420px">
      <el-form>
        <el-form-item label="项目名称" required>
          <el-input v-model="newName" />
        </el-form-item>
        <el-form-item label="项目描述">
          <el-input v-model="newDescription" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="create">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createProject, getProjects, updateProject } from '@/api'
import type { Project } from '@/types'

const projects = ref<Project[]>([])
const projectId = ref('')
const executeServiceUrl = ref('')
const skywalkingGraphqlUrl = ref('')
const trafficTaggingEnabled = ref(false)
const apiExchangeKafkaEnabled = ref(false)
const saving = ref(false)
const showCreate = ref(false)
const newName = ref('')
const newDescription = ref('')
const selectedProject = computed(() => projects.value.find(p => p.id === projectId.value))

const load = async () => {
  const response: any = await getProjects({ size: 9999 })
  projects.value = response?.items || response?.data?.items || (Array.isArray(response) ? response : [])
}

const selectProject = () => {
  executeServiceUrl.value = selectedProject.value?.executeServiceUrl || ''
  skywalkingGraphqlUrl.value = selectedProject.value?.skywalkingGraphqlUrl || ''
  trafficTaggingEnabled.value = !!selectedProject.value?.trafficTaggingEnabled
  apiExchangeKafkaEnabled.value = !!selectedProject.value?.apiExchangeKafkaEnabled
}

const save = async () => {
  if (!selectedProject.value?.id) return
  saving.value = true
  try {
    await updateProject(selectedProject.value.id, {
      ...selectedProject.value,
      executeServiceUrl: executeServiceUrl.value.trim(),
      skywalkingGraphqlUrl: skywalkingGraphqlUrl.value.trim(),
      trafficTaggingEnabled: trafficTaggingEnabled.value,
      apiExchangeKafkaEnabled: apiExchangeKafkaEnabled.value
    })
    selectedProject.value.executeServiceUrl = executeServiceUrl.value.trim()
    selectedProject.value.skywalkingGraphqlUrl = skywalkingGraphqlUrl.value.trim()
    selectedProject.value.trafficTaggingEnabled = trafficTaggingEnabled.value
    selectedProject.value.apiExchangeKafkaEnabled = apiExchangeKafkaEnabled.value
    ElMessage.success('项目设置已保存')
  } catch (error: any) {
    ElMessage.error(error?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const create = async () => {
  if (!newName.value.trim()) {
    ElMessage.warning('请输入项目名称')
    return
  }
  const created: any = await createProject({ name: newName.value.trim(), description: newDescription.value.trim() })
  projects.value.push(created)
  projectId.value = created.id
  selectProject()
  showCreate.value = false
  newName.value = ''
  newDescription.value = ''
  ElMessage.success('项目创建成功')
}

onMounted(load)
</script>

<style scoped lang="scss">
.toolbar {
  background: #fff;
  padding: 16px 20px;
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, .08);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title { font-size: 18px; font-weight: 600; }
.full-width { width: 100%; }
.hint { line-height: 1.5; color: #909399; font-size: 12px; margin-top: 6px; }
</style>
