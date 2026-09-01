<template>
  <div class="detail-view">
    <el-page-header @back="goBack" content="用例详情">
      <template #extra>
        <el-button type="primary" :loading="saving" @click="handleSave">
          <el-icon><Document /></el-icon>保存
        </el-button>
        <el-button type="warning" :loading="executing" :disabled="executing" @click="handleExecute">
          <el-icon><VideoPlay /></el-icon>执行
        </el-button>
        <el-button type="success" :disabled="!(detail as any).htmlReportPath" @click="goReport">
          <el-icon><Tickets /></el-icon>查看报告
        </el-button>
        <el-button type="info" @click="viewCache">查看缓存</el-button>
      </template>
    </el-page-header>

    <el-row :gutter="20" class="detail-content">
      <el-col :span="8">
        <div class="info-card">
          <h3 class="card-title"><el-icon><InfoFilled /></el-icon>基本信息</h3>
          <div class="info-list">
            <div class="info-item"><span class="info-label">用例ID</span><span class="info-value">{{ (detail as any).id || '-' }}</span></div>
            <div class="info-item">
              <span class="info-label">用例名称</span>
              <div class="info-value name-edit-wrap">
                <template v-if="editingName">
                  <el-input
                    ref="nameInputRef"
                    v-model="editNameValue"
                    size="small"
                    class="name-edit-input"
                    @blur="saveCaseName"
                    @keydown.enter="saveCaseName"
                    @keydown.escape="cancelEditName"
                  />
                </template>
                <template v-else>
                  <span class="name-display" @click="startEditName">{{ (detail as any).name || '-' }}</span>
                  <el-button :icon="Edit" size="small" text class="name-edit-btn" @click="startEditName" />
                </template>
              </div>
            </div>
            <div class="info-item"><span class="info-label">所属项目</span><el-tag size="small">{{ (detail as any).project || '默认项目' }}</el-tag></div>
            <div class="info-item"><span class="info-label">执行状态</span><el-tag :type="getStatusType((detail as any).status)" size="small">{{ getStatusName((detail as any).status) }}</el-tag></div>
            <div v-if="(detail as any).description" class="info-item"><span class="info-label">用例描述</span><span class="info-value">{{ (detail as any).description }}</span></div>
            <div class="info-item"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime((detail as any).createdAt) }}</span></div>
          </div>
        </div>

        <div class="info-card mt-20">
          <h3 class="card-title"><el-icon><ChatLineSquare /></el-icon>NLP测试步骤</h3>
          <el-input v-model="nlpText" type="textarea" :rows="5" placeholder="输入NLP测试指令" />
          <el-radio-group v-model="executionMode" style="margin-top:10px"><el-radio-button label="NLP">案例描述执行</el-radio-button><el-radio-button label="YAML">YAML 脚本执行</el-radio-button></el-radio-group>
          <el-button type="success" :loading="generatingScript" style="margin-top:10px" @click="openGenerateScript">生成脚本</el-button>
        </div>

      </el-col>

      <el-col :span="16">
        <div class="editor-card">
          <YamlEditor ref="yamlEditorRef" v-model="yamlConfig" v-model:yaml-value="yamlContent" @execute-custom-yaml="handleExecuteCustomYaml" />
        </div>
      </el-col>
    </el-row>
    <el-dialog v-model="cacheDialog" title="Midscene 缓存" width="760px"><el-input v-model="cacheText" type="textarea" :rows="18" readonly /></el-dialog>
    <AiScriptGeneratorDialog
      v-model="streamDialog"
      v-model:nlp="generatorNlp"
      v-model:yaml="streamedScript"
      :reasoning="streamedReasoning"
      :generating="generatingScript"
      @regenerate="generateScript"
      @confirm="confirmGeneratedScript"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { InfoFilled, ChatLineSquare, Tickets, Edit, Document, VideoPlay } from '@element-plus/icons-vue'
import { YamlEditor } from '@/components/yaml'
import { AiScriptGeneratorDialog } from '@/components/common'
import { useCaseStore, useConfigStore } from '@/stores'
import { getCase, getCaseCache, updateCase, streamNlpToYaml } from '@/api'
import { formatDate } from '@/utils'
import type { YamlConfig } from '@/types'

const route = useRoute()
const router = useRouter()
const caseStore = useCaseStore()
const configStore = useConfigStore()

const yamlEditorRef = ref<InstanceType<typeof YamlEditor>>()
const executing = ref(false)
const saving = ref(false)
const detail = ref<any>({})
const nlpText = ref('')
const yamlConfig = ref<YamlConfig>({ type: 'web', url: '', timeout: 600000, tasks: [] })
const yamlContent = ref('')
const generatingScript = ref(false)
const streamedScript = ref('')
const streamedReasoning = ref('')
const streamDialog = ref(false)
const generatorNlp = ref('')
const executionMode = ref<'NLP' | 'YAML'>('NLP')
const executionLogs = ref<Array<{ time: string; message: string; type: string }>>([])
const cacheDialog = ref(false)
const cacheText = ref('')
const viewCache = async () => { try { cacheText.value = await getCaseCache(String(route.params.id)); cacheDialog.value = true } catch { ElMessage.info('该用例暂无缓存文件') } }

// 名称编辑状态
const editingName = ref(false)
const editNameValue = ref('')
const nameInputRef = ref<any>()
const startEditName = () => {
  editNameValue.value = (detail.value as any)?.name || ''
  editingName.value = true
  setTimeout(() => nameInputRef.value?.focus(), 50)
}
const saveCaseName = async () => {
  editingName.value = false
  const newName = editNameValue.value.trim()
  if (!newName || newName === (detail.value as any)?.name) return
  try {
    const res = await updateCase(String(route.params.id), { name: newName })
    if (res) { detail.value = { ...detail.value, name: newName }; ElMessage.success('名称已更新') }
  } catch { ElMessage.error('更新失败'); editNameValue.value = (detail.value as any)?.name || '' }
}
const cancelEditName = () => { editingName.value = false; editNameValue.value = (detail.value as any)?.name || '' }

const getStatusType = (status: string) => {
  const map: Record<string, string> = { success: 'success', failed: 'danger', running: 'warning', pending: 'info' }
  return (map[status] || 'info') as any
}
const getStatusName = (status: string) => {
  const map: Record<string, string> = { success: '成功', failed: '失败', running: '执行中', pending: '待执行' }
  return map[status] || status
}
const formatDateTime = (date: string) => !date ? '-' : formatDate(date, 'YYYY-MM-DD HH:mm')

// 从 script 中提取 YAML 内容
const extractYamlFromScript = (script: string): string => {
  if (!script) return ''
  const match = script.match(/runYaml\(`([\s\S]*?)`\)/)
  if (match && match[1]) return match[1].trim()
  return ''
}

// 清理NLP中的多余标记
const cleanNlp = (nlp: string): string => {
  return nlp.replace(/\s*\|\s*YAML已更新[：:].*$/g, '').trim()
}

const generateScript = async (nlp = generatorNlp.value) => {
  if (!nlp.trim()) { ElMessage.warning('请输入NLP测试指令'); return }
  generatorNlp.value = nlp
  generatingScript.value = true
  streamedScript.value = ''; streamedReasoning.value = ''; streamDialog.value = true
  try { const yaml = await streamNlpToYaml(nlp.trim(), chunk => { streamedScript.value += chunk }, reasoning => { streamedReasoning.value += reasoning }); streamedScript.value = yaml } catch (e: any) { ElMessage.error(e.message || '脚本生成失败') } finally { generatingScript.value = false }
}

const openGenerateScript = () => {
  generatorNlp.value = nlpText.value
  return generateScript()
}

const confirmGeneratedScript = async ({ nlp, yaml }: { nlp: string; yaml: string }) => {
  nlpText.value = nlp.trim()
  yamlContent.value = yaml
  yamlEditorRef.value?.loadFromYaml(yaml)
  try {
    const updated = await updateCase(String(route.params.id), { nlp: nlpText.value, yamlFlow: yaml })
    detail.value = { ...detail.value, ...(updated || {}), nlp: nlpText.value, yamlFlow: yaml }
    streamDialog.value = false
    ElMessage.success('测试步骤和 YAML 脚本已回写')
  } catch (e: any) { ElMessage.error(e?.message || '回写用例失败') }
}

const fetchCaseDetail = async () => {
  const id = route.params.id as string
  if (!id) return
  try {
    const res = await getCase(id)
    detail.value = res || {}
    executionMode.value = (res as any)?.executionMode === 'YAML' ? 'YAML' : 'NLP'
    nlpText.value = cleanNlp((res as any)?.nlp || '')

    // 加载 YAML：优先 yamlFlow → 从 script 提取 → NLP 转换
    const yamlFlow = (res as any)?.yamlFlow || ''
    const script = (res as any)?.script || ''
    const yamlFromScript = extractYamlFromScript(script)
    if (yamlFlow) {
      yamlEditorRef.value?.loadFromYaml(yamlFlow)
    } else if (yamlFromScript) {
      yamlEditorRef.value?.loadFromYaml(yamlFromScript)
    }
  } catch (error) {
    ElMessage.error('获取用例详情失败')
  }
}

const goBack = () => router.push('/cases')
const goReport = () => {
  const reportUrl = (detail.value as any)?.htmlReportPath
  if (reportUrl) window.open(reportUrl, '_blank')
}

// 保存：将当前 NLP 和 YAML 一并回写到用例
const handleSave = async () => {
  const id = (detail.value as any)?.id
  if (!id) { ElMessage.warning('无用例ID'); return }
  saving.value = true
  try {
    // 确保表单编辑区的最新内容已同步到 YAML
    yamlEditorRef.value?.syncFormToYaml()
    const yaml = yamlEditorRef.value?.getYamlContent() || ''
    const updated = await updateCase(String(id), {
      nlp: nlpText.value.trim(),
      yamlFlow: yaml,
      executionMode: executionMode.value
    })
    detail.value = { ...detail.value, ...(updated || {}), nlp: nlpText.value.trim(), yamlFlow: yaml }
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 执行按钮：使用当前编辑器的 YAML 执行
const handleExecute = async () => {
  const mode = executionMode.value
  yamlEditorRef.value?.syncFormToYaml()
  const yaml = yamlEditorRef.value?.getYamlContent() || ''
  if (mode === 'YAML' && !yaml.trim()) { ElMessage.warning('yaml脚本未生成'); return }
  if (mode === 'NLP') {
    const id = (detail.value as any)?.id
    if (!nlpText.value.trim()) { ElMessage.warning('NLP案例描述未填写'); return }
    executing.value = true
    try { const r: any = await caseStore.runCase(id, undefined, configStore.aiConfig.browserMode === 'headless'); if (r?.executionId) ElMessage.success('执行任务已提交'); else ElMessage.error(r?.response?.data?.error || '执行失败') }
    finally { executing.value = false }
    return
  }
  handleExecuteCustomYaml(yaml)
}

// 自定义YAML执行
const handleExecuteCustomYaml = async (yaml: string) => {
  const id = (detail.value as any)?.id
  if (!id) { ElMessage.warning('无用例ID'); return }
  executing.value = true; executionLogs.value = []
  const now = new Date()
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
  executionLogs.value.push({ time: ts, message: '开始执行自定义YAML...', type: 'info' })
  try {
    // 与用例列表、创建页保持一致：将全局浏览器模式传递给执行接口。
    const headless = configStore.aiConfig.browserMode === 'headless'
    const result = await caseStore.runCase(id, yaml, headless)
    const r = result as any
    if (r?.success !== false) { executionLogs.value.push({ time: ts, message: '测试执行完成', type: 'success' }) }
    else { executionLogs.value.push({ time: ts, message: '测试执行失败', type: 'error' }) }
    if (r?.errorDetail) executionLogs.value.push({ time: ts, message: `错误详情: ${r.errorDetail}`, type: 'error' })
    if (r?.logs && Array.isArray(r.logs)) r.logs.slice(0, 50).forEach((log: string) => {
      executionLogs.value.push({ time: ts, message: log.trim(), type: log.includes('Error') || log.includes('失败') ? 'error' : log.includes('成功') ? 'success' : 'info' })
    })
    // 更新状态
    await caseStore.fetchCases()
    const updated = caseStore.cases.find(c => c.id === id)
    if (updated) detail.value = { ...detail.value, status: updated.status }
  } catch (error: any) { executionLogs.value.push({ time: ts, message: `执行异常: ${error.message || ''}`, type: 'error' })
  } finally { executing.value = false }
}

onMounted(async () => {
  await configStore.fetchAIConfig()
  await caseStore.fetchCases()
  await fetchCaseDetail()
})
</script>

<style lang="scss" scoped>
.detail-view {
  font-size: 15px;
  .detail-content { margin-top: 20px; }
  .info-card {
    background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 16px rgba(0,0,0,0.06);
    &.mt-20 { margin-top: 20px; }
    .card-title {
      display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 600;
      color: #303133; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #e8ecf1;
      .el-icon { color: #409eff; font-size: 20px; }
    }
    .info-list, .ai-config-list {
      .info-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 0; border-bottom: 1px dashed #f0f0f0;
        &:last-child { border-bottom: none; }
        .info-label { font-size: 14px; color: #909399; flex-shrink: 0; margin-right: 12px; font-weight: 500; }
        .info-value { font-size: 14px; color: #303133; text-align: right; word-break: break-all; }
        .name-edit-wrap {
          display: flex; align-items: center; gap: 6px; justify-content: flex-end;
          .name-display { cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: background .15s;
            &:hover { background: #f0f5ff; }
          }
          .name-edit-btn { opacity: 0; transition: opacity .15s; padding: 2px; }
          &:hover .name-edit-btn { opacity: 1; }
          .name-edit-input { width: 200px; }
        }
      }
    }
  }
  .editor-card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
}

</style>
<style lang="scss">.stream-markdown{height:62vh;overflow:auto;padding:18px;background:#15181d;color:#e6edf3;border-radius:8px;font:14px/1.7 Consolas,monospace}.stream-markdown pre{padding:14px;background:#0d1117;border-radius:6px;overflow:auto}.stream-markdown code{color:#a5d6ff}.stream-markdown h1,.stream-markdown h2,.stream-markdown h3{color:#79c0ff}</style>
