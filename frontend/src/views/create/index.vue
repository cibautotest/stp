<template>
  <div class="create-view">
    <el-row :gutter="24">
      <el-col :span="10">
        <div class="nlp-panel">
          <h3 class="panel-title">
            <el-icon><ChatLineSquare /></el-icon>
            创建测试用例
          </h3>

          <div class="form-item">
            <label class="form-label">所属目录 <span class="required">*</span></label>
            <el-select v-model="directoryId" placeholder="请选择目录" :disabled="!currentProjectId" class="project-select">
              <el-option v-for="directory in directories" :key="directory.id" :label="directory.name" :value="directory.id" />
            </el-select>
          </div>

          <!-- 用例名称 -->
          <div class="form-item">
            <label class="form-label">用例名称 <span class="required">*</span></label>
            <el-input
              v-model="caseName"
              placeholder="例如：百度搜索测试"
              clearable
            />
          </div>

          <!-- 用例描述 -->
          <div class="form-item">
            <label class="form-label">用例描述</label>
            <el-input
              v-model="caseDescription"
              type="textarea"
              :rows="2"
              placeholder="描述此用例的业务含义，如：验证搜索功能正常"
              clearable
            />
          </div>

          <!-- NLP指令输入 -->
          <div class="form-item">
            <label class="form-label">测试指令（NLP） <span class="required">*</span></label>
            <el-input
              v-model="nlpInstruction"
              type="textarea"
              :rows="4"
              placeholder="例如：打开 https://www.ebay.com，输入 'Headphones'，点击搜索按钮"
            />
          </div>

          <!-- 按钮组 -->
          <div class="form-item">
            <label class="form-label">执行方式</label>
            <el-radio-group v-model="executionMode">
              <el-radio-button label="NLP">案例描述执行</el-radio-button>
              <el-radio-button label="YAML">YAML 脚本执行</el-radio-button>
            </el-radio-group>
          </div>
          <div class="action-buttons">
            <el-dropdown split-button type="warning" :loading="executing" :disabled="executing || !currentProjectId" @click="handleDebug(false)" @command="handleDebug">
              <el-icon><VideoPlay /></el-icon>有头调试
              <template #dropdown><el-dropdown-menu><el-dropdown-item :command="false">有头调试</el-dropdown-item><el-dropdown-item :command="true">无头调试</el-dropdown-item></el-dropdown-menu></template>
            </el-dropdown>
            <el-button v-if="debugExecutionId" type="danger" :loading="stopping" @click="stopDebug">停止调试</el-button>
            <el-button type="primary" :disabled="!currentProjectId" @click="handleCreateCase">
              <el-icon><Document /></el-icon>
              创建
            </el-button>
            <el-button type="success" @click="handleGenerateScript">
              <el-icon><MagicStick /></el-icon>
              生成脚本
            </el-button>
          </div>
        </div>

        <!-- 执行日志终端（默认缩小） -->
        <div class="terminal-section">
          <ExecutionTerminal
            :logs="executionLogs"
            :status="executionStatus"
          />
        </div>
      </el-col>

      <el-col :span="14">
        <div class="editor-panel">
          <YamlEditor
            ref="yamlEditorRef"
            v-model="yamlConfig"
            v-model:yaml-value="yamlContent"
            :case-name="caseName"
          />
        </div>
      </el-col>
    </el-row>

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
import { ref, onMounted, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ChatLineSquare, MagicStick, VideoPlay, Document } from '@element-plus/icons-vue'
import { YamlEditor } from '@/components/yaml'
import { AiScriptGeneratorDialog, ExecutionTerminal } from '@/components/common'
import { useProjectStore, useCaseStore, useConfigStore } from '@/stores'
import { nlpToActions, debugExecute, cancelDebugExecute, getCaseDirectories, streamNlpToYaml, type CaseDirectory } from '@/api/cases'
import { request } from '@/api'
import type { YamlConfig, FlowStepType } from '@/types'

const projectStore = useProjectStore()
const caseStore = useCaseStore()
const configStore = useConfigStore()

const yamlEditorRef = ref<InstanceType<typeof YamlEditor>>()

const directoryId = ref('')
const directories = ref<CaseDirectory[]>([])
const caseName = ref('')
const caseDescription = ref('')
const nlpInstruction = ref('')
const executionMode = ref<'NLP' | 'YAML'>('NLP')
const yamlConfig = ref<YamlConfig>({ type: 'web', url: 'https://www.baidu.com', timeout: 600000, tasks: [] })
const yamlContent = ref('')
const generatingScript = ref(false)
const streamedScript = ref('')
const streamedReasoning = ref('')
const streamDialog = ref(false)
const generatorNlp = ref('')
const executing = ref(false)
const stopping = ref(false)
const debugExecutionId = ref('')

interface LogEntry { time: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }
const executionLogs = ref<LogEntry[]>([])
const executionStatus = ref<'idle' | 'running' | 'success' | 'failed'>('idle')

const currentProjectId = computed(() => projectStore.currentProject?.id || '')

const cleanNlp = (nlp: string): string => {
  return nlp.replace(/\s*\|\s*YAML已更新[：:].*$/g, '').trim()
}

const nlpToYaml = async (nlp: string, presetUrl?: string): Promise<string> => {
  if (!nlp) return ''
  const cleaned = cleanNlp(nlp)
  const urlMatch = cleaned.match(/https?:\/\/[^\s，,]+/)
  // NLP 中的 URL 优先于表单默认值（用户输入新网址时以 NLP 为准）
  const url = (urlMatch ? urlMatch[0] : '') || presetUrl || ''

  let yaml = ''
  if (url) yaml += `web:\n  url: ${url}\n  timeout: 600000\n`
  else yaml += `web:\n  timeout: 600000\n`

  yaml += `\ntasks:\n`

  try {
    // Call backend AI to split NLP into typed actions
    const steps = await nlpToActions(cleaned)
    console.log('[NLP] AI returned', steps.length, 'steps:', steps)
    if (steps.length > 0) {
      yaml += `  - name: AI 测试\n`
      yaml += `    flow:\n`
      steps.forEach((step: any) => {
        yaml += `      - ${step.type}: ${step.prompt}\n`
        if (step.type === 'aiInput' && step.value) {
          yaml += `        value: ${step.value}\n`
        }
      })
      return yaml
    }
  } catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '未知错误'
    ElMessage.warning('AI 步骤拆解失败，使用默认拆分: ' + msg)
    console.warn('[NLP] AI split failed:', e)
  }

  // Fallback: simple line-based split
  let lines = cleaned.split(/\n/).map(l => l.trim()).filter(l => l.length > 0)
  if (url) lines = lines.filter(l => l !== url)
  if (lines.length === 0) return ''

  lines.forEach(line => {
    const taskName = line.length > 30 ? line.substring(0, 30) + '...' : line
    yaml += `  - name: ${taskName}\n`
    yaml += `    flow:\n`
    yaml += `      - ai: ${line}\n`
  })
  return yaml
}

// NLP修改时同步到YAML编辑器
const syncNlpToYaml = async () => {
  if (nlpInstruction.value) {
    const formUrl = yamlEditorRef.value?.getFormData()?.url || ''
    const yamlStr = await nlpToYaml(nlpInstruction.value, formUrl)
    yamlEditorRef.value?.loadFromYaml(yamlStr)
  }
}

// 生成脚本：调 AI 拆解 NLP → 多 action 类型
const generateScript = async (nlp = generatorNlp.value) => {
  if (!nlp.trim()) { ElMessage.warning('请先输入测试指令（NLP）'); return }
  generatorNlp.value = nlp
  generatingScript.value = true; streamedScript.value = ''; streamedReasoning.value = ''; streamDialog.value = true
  try {
    const yaml = await streamNlpToYaml(nlp.trim(), chunk => { streamedScript.value += chunk }, reasoning => { streamedReasoning.value += reasoning })
    streamedScript.value = yaml
  } catch (e: any) { ElMessage.error(e.message || '脚本生成失败') } finally { generatingScript.value = false }
}

const handleGenerateScript = () => {
  generatorNlp.value = nlpInstruction.value
  return generateScript()
}

const confirmGeneratedScript = ({ nlp, yaml }: { nlp: string; yaml: string }) => {
  nlpInstruction.value = nlp.trim()
  yamlContent.value = yaml
  yamlEditorRef.value?.loadFromYaml(yaml)
  streamDialog.value = false
  ElMessage.success('测试步骤和 YAML 脚本已回写')
}

onMounted(async () => {
  await Promise.all([caseStore.fetchCases(), configStore.fetchAIConfig()])
  await projectStore.fetchProjects()
})
watch(currentProjectId, async id => { directoryId.value = ''; directories.value = id ? await getCaseDirectories(id) : [] }, { immediate: true })

const handleClear = () => { caseName.value = ''; caseDescription.value = ''; nlpInstruction.value = ''; directoryId.value = ''; yamlEditorRef.value?.reset() }

const addLog = (message: string, type: LogEntry['type'] = 'info') => {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  executionLogs.value.push({ time, message, type })
}

// 调试只执行当前 YAML 草稿，不创建测试用例。
const handleDebug = async (headless: boolean) => {
  if (!currentProjectId.value) { ElMessage.warning('请先在右上角选择项目'); return }
  yamlEditorRef.value?.syncFormToYaml()
  const yaml = yamlEditorRef.value?.getYamlContent() || yamlContent.value
  if (executionMode.value === 'YAML' && !yaml.trim()) { ElMessage.warning('yaml脚本未生成'); return }
  if (executionMode.value === 'NLP' && !nlpInstruction.value.trim()) { ElMessage.warning('请输入测试指令（NLP）'); return }
  executing.value = true
  executionLogs.value = []
  executionStatus.value = 'running'
  addLog(`正在提交未保存的 YAML 草稿进行${headless ? '无头' : '有头'}调试…`)
  try {
    const result = await debugExecute({
      projectId: currentProjectId.value,
      name: caseName.value.trim() || '未保存用例调试',
      nlp: nlpInstruction.value.trim(),
      yamlScript: yaml,
      executionMode: executionMode.value,
      headless
    })
    debugExecutionId.value = result.executionId
    addLog(`调试任务已提交，任务 ID: ${result.executionId}`, 'info')
    ElMessage.success('调试任务已提交；该操作不会创建测试用例')
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      const status = await request.get<{ status: string; reportUrl?: string; error?: string }>(
        `/platform/execute/${encodeURIComponent(result.executionId)}/status`
      )
      if (status.status === 'completed') {
        addLog('调试执行完成', 'success')
        if (status.reportUrl) addLog(`HTML 报告: ${status.reportUrl}`, 'info')
        executionStatus.value = 'success'
        debugExecutionId.value = ''
        return
      }
      if (status.status === 'failed' || status.status === 'cancelled') {
        addLog(`调试执行失败: ${status.error || '执行机返回失败'}`, 'error')
        executionStatus.value = 'failed'
        debugExecutionId.value = ''
        return
      }
      addLog(status.status === 'running' ? '正在调试执行…' : '调试任务排队中…')
    }
    addLog('调试执行超时，请稍后查看执行机日志', 'error')
    executionStatus.value = 'failed'
    debugExecutionId.value = ''
  } catch (error: any) {
    const message = error?.response?.data?.error || error?.message || '调试任务提交失败'
    addLog(`调试失败: ${message}`, 'error')
    executionStatus.value = 'failed'
  } finally {
    executing.value = false
  }
}

const stopDebug = async () => {
  if (!debugExecutionId.value) return
  stopping.value = true
  try {
    await cancelDebugExecute(debugExecutionId.value)
    addLog('已请求停止调试任务', 'warning')
    executionStatus.value = 'failed'
    debugExecutionId.value = ''
    ElMessage.success('调试任务已停止')
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || '停止调试失败')
  } finally { stopping.value = false }
}

// 创建仅保存当前编辑内容，不触发执行。
const handleCreateCase = async () => {
  if (!currentProjectId.value) { ElMessage.warning('请先在右上角选择项目'); return }
  if (!caseName.value.trim()) { ElMessage.warning('请输入用例名称'); return }
  if (!nlpInstruction.value.trim()) { ElMessage.warning('请输入测试指令（NLP）'); return }
  if (!directoryId.value) { ElMessage.warning('请选择所属目录'); return }
  yamlEditorRef.value?.syncFormToYaml()
  const yaml = yamlEditorRef.value?.getYamlContent() || yamlContent.value
  try {
    const created = await caseStore.addCase({
      projectId: currentProjectId.value,
      directoryId: directoryId.value,
      name: caseName.value.trim(),
      description: caseDescription.value.trim() || undefined,
      nlp: nlpInstruction.value.trim(),
      yamlFlow: yaml
    })
    if (!created) throw new Error('创建测试用例失败')
    ElMessage.success('测试用例创建成功')
    handleClear()
  } catch (error: any) {
    ElMessage.error(error?.response?.data?.error || error?.message || '创建测试用例失败')
  }
}

// 异步执行&保存
const handleExecuteAndSave = async () => {
  if (!currentProjectId.value) { addLog('请先在右上角选择项目', 'warning'); return }
  if (!caseName.value.trim()) { addLog('请输入用例名称', 'warning'); return }
  if (!nlpInstruction.value.trim()) { addLog('请输入测试指令（NLP）', 'warning'); return }
  executing.value = true
  executionLogs.value = []
  executionStatus.value = 'running'
  addLog('正在创建用例并启动异步执行...', 'info')

  try {
    // 提交前同步：表单 → YAML
    yamlEditorRef.value?.syncFormToYaml()
    syncNlpToYaml()

    const result = await caseStore.runCaseAsync(
      {
        projectId: currentProjectId.value,
        directoryId: directoryId.value,
        name: caseName.value.trim(),
        description: caseDescription.value.trim() || undefined,
        nlp: nlpInstruction.value,
        customYaml: yamlContent.value,
        executionMode: executionMode.value,
        headless: configStore.aiConfig.browserMode === 'headless'
      },
      (status, reportUrl, queuePosition, errorDetail) => {
        if (status === 'queued') {
          if (queuePosition !== undefined && queuePosition >= 0) {
            addLog(`排队中（第 ${queuePosition} 位），等待执行...`, 'info')
          } else {
            addLog('任务已入队，等待执行...', 'info')
          }
        }
        else if (status === 'running') addLog('正在执行测试...', 'info')
        else if (status === 'completed') {
          addLog('测试执行完成', 'success')
          executionStatus.value = 'success'
          if (reportUrl) addLog(`HTML 报告: ${reportUrl}`, 'info')
        } else if (status === 'submit_failed') {
          addLog('用例已保存，但执行提交失败（检查 YAML 是否包含 web.url 和 tasks）', 'warning')
          executionStatus.value = 'failed'
        } else if (status === 'failed') {
          const failMsg = errorDetail ? `测试执行失败：${errorDetail}` : '测试执行失败'
          addLog(failMsg, 'error')
          executionStatus.value = 'failed'
        }
      }
    )

    if (!result) {
      addLog('执行失败：无法连接到执行服务', 'error')
      executionStatus.value = 'failed'
    } else if (result.errorType) {
      // 根据 errorType 展示精准错误信息
      if (result.errorType === 'submit_failed') {
        addLog('用例已保存成功，但执行提交失败（检查 YAML 是否包含 web.url 和 tasks）', 'warning')
        executionStatus.value = 'failed'
        ElMessage.warning('用例保存成功，但执行提交失败')
      } else if (result.errorType === 'timeout') {
        addLog(result.errorDetail || '执行超时，任务未在预期时间内完成', 'error')
        executionStatus.value = 'failed'
        ElMessage.warning('用例保存成功，但执行超时')
      } else if (result.errorType === 'network_error') {
        addLog(result.errorDetail || '执行状态查询失败：无法连接到执行服务', 'error')
        executionStatus.value = 'failed'
        ElMessage.error('执行服务连接失败')
      } else if (result.errorType === 'execution_failed') {
        addLog(result.errorDetail || '测试执行失败', 'error')
        executionStatus.value = 'failed'
        ElMessage.warning('用例保存成功，但执行失败')
      } else {
        addLog('用例已保存，但执行未成功完成', 'warning')
        executionStatus.value = 'failed'
        ElMessage.warning('用例保存成功，但执行失败')
      }
    } else if (result.success && result.executionId) {
      // 用例创建并执行成功
      ElMessage.success('用例创建并执行成功')
      handleClear()
    } else if (!result.executionId) {
      // 用例已保存，但执行提交失败（execute-service 不可用或 YAML 校验不通过）
      addLog('用例已保存成功，但执行提交失败（检查 YAML 是否包含 web.url 和 tasks）', 'warning')
      executionStatus.value = 'failed'
      ElMessage.warning('用例保存成功，但执行提交失败')
    } else {
      // 用例已保存，执行已提交但未成功完成（超时或执行失败）
      addLog('用例已保存，但执行未成功完成', 'warning')
      executionStatus.value = 'failed'
      ElMessage.warning('用例保存成功，但执行失败')
    }
  } catch (error: any) {
    const message = error?.response?.data?.error || error?.message || '执行失败'
    if (message.includes('未配置执行机')) {
      addLog('未配置执行机：请在“项目设置”配置项目执行机，或请管理员在“用户管理”配置用户执行机。', 'error')
      ElMessage.error('未配置执行机，无法启动执行')
    } else {
      addLog(`执行失败: ${message}`, 'error')
    }
    executionStatus.value = 'failed'
  } finally {
    executing.value = false
  }
}
</script>

<style lang="scss" scoped>
.create-view {
  font-size: 15px;
  .nlp-panel {
    background: #fff; border-radius: 12px; padding: 24px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06); margin-bottom: 20px;
    .panel-title {
      display: flex; align-items: center; gap: 10px; font-size: 19px; font-weight: 600;
      color: #1a1a2e; margin-bottom: 22px; padding-bottom: 16px;
      border-bottom: 2px solid #409eff;
      .el-icon { font-size: 22px; color: #409eff; }
    }
    .form-item {
      margin-bottom: 22px;
      .form-label { display: block; font-size: 15px; font-weight: 500; color: #606266; margin-bottom: 8px; }
      .required { color: #f56c6c; margin-left: 2px; }
    }
    .project-selector { display: flex; gap: 12px; .project-select { flex: 1; } }
    .action-buttons { display: flex; gap: 12px; flex-wrap: wrap; }
  }
  .terminal-section { margin-top: 20px; }
  .editor-panel {
    background: #fff; border-radius: 12px; padding: 24px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  }
}
</style>
