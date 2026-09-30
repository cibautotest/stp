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

          <!-- 登录方式（必选） -->
          <div class="form-item">
            <label class="form-label">登录方式 <span class="required">*</span></label>
            <el-radio-group v-model="loginType">
              <el-radio label="none">不用输入账号密码</el-radio>
              <el-radio label="cas">CAS 登录</el-radio>
              <el-radio label="local">本地登录</el-radio>
            </el-radio-group>
          </div>

          <!-- 免登录：仅需网址 -->
          <div v-if="loginType === 'none'" class="form-item">
            <label class="form-label">目标网址 <span class="required">*</span></label>
            <el-input v-model="noneUrl" placeholder="例如：https://www.example.com" />
          </div>

          <div v-if="loginType && loginType !== 'none'" class="form-item login-role-item">
            <el-select v-model="selectedLoginMethodId" placeholder="请选择登录账号" class="project-select" :disabled="!currentProjectId">
              <el-option v-for="m in filteredLoginMethods" :key="m.id" :value="m.id" :label="m.username || m.name">
                <span>{{ m.username || m.name }}</span>
                <span class="cache-tag" :class="m.cacheStatus === 'cached' ? 'is-cached' : 'is-uncached'">
                  {{ m.cacheStatus === 'cached' ? '已执行过，有缓存' : '未缓存' }}
                </span>
              </el-option>
              <el-option value="__NEW__" label="➕ 新建登录账号…" />
            </el-select>
            <div v-if="selectedLoginMethodId === '__NEW__'" class="login-new-form">
              <div class="login-field-row">
                <span class="login-field-label">登录网址</span>
                <el-input v-model="newLogin.loginUrl" placeholder="例如：https://sso.example.com/login" class="login-field-input" />
              </div>
              <div class="login-field-row">
                <span class="login-field-label">账号</span>
                <el-input v-model="newLogin.username" placeholder="登录账号" class="login-field-input" />
              </div>
              <div class="login-field-row">
                <span class="login-field-label">密码</span>
                <el-input v-model="newLogin.password" placeholder="登录密码" show-password class="login-field-input" />
              </div>
              <div v-for="(step, si) in newLogin.extraSteps" :key="si" class="login-extra-step">
                <div class="login-field-row">
                  <span class="login-field-label">动态值类型</span>
                  <el-select v-model="step.valueType" placeholder="请选择动态值" class="login-field-input">
                    <el-option v-for="opt in dynamicValueOptions" :key="opt" :label="opt" :value="opt" />
                  </el-select>
                </div>
                <div v-if="step.valueType === '自定义'" class="login-field-row">
                  <span class="login-field-label">自定义名称</span>
                  <el-input v-model="step.customName" placeholder="请输入动态值名称" class="login-field-input" />
                </div>
                <div class="login-field-row">
                  <span class="login-field-label">补充步骤</span>
                  <el-input v-model="step.desc" placeholder="该动态值的处理步骤，如：识别图形验证码并填入" class="login-field-input" />
                  <el-button type="danger" link @click="newLogin.extraSteps.splice(si, 1)">删除</el-button>
                </div>
              </div>
              <el-button type="primary" link @click="newLogin.extraSteps.push({ valueType: '', customName: '', desc: '' })">
                ➕ 新增补充步骤
              </el-button>
              <div class="login-new-actions">
                <el-button type="primary" :loading="savingLogin" @click="saveNewLoginMethod">确认保存</el-button>
                <span class="login-save-hint">保存后即可用于生成脚本 / 调试 / 执行（角色名默认为账号）</span>
              </div>
            </div>
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
              placeholder="登录后的步骤：输入xxx，点击xxx，验证xxx（登录步骤由上方登录方式自动处理，无需在此描述）"
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
import { nlpToActions, debugExecute, cancelDebugExecute, getCaseDirectories, streamNlpToYaml, getLoginMethods, createLoginMethod, type CaseDirectory, type LoginMethod, type LoginMethodType } from '@/api/cases'
import yamlLib from 'js-yaml'
import { request } from '@/api'
import type { YamlConfig, FlowStepType } from '@/types'

const projectStore = useProjectStore()
const caseStore = useCaseStore()
const configStore = useConfigStore()

const yamlEditorRef = ref<InstanceType<typeof YamlEditor>>()

const directoryId = ref('')
const directories = ref<CaseDirectory[]>([])

// ── 登录方式（必选） ──
const loginType = ref<LoginMethodType | ''>('')
const loginMethods = ref<LoginMethod[]>([])
const selectedLoginMethodId = ref('')
const noneUrl = ref('')

interface ExtraStep { valueType: string; customName: string; desc: string }
const dynamicValueOptions = ['图形验证码', '短信验证码', '滑块验证', '邮件验证码', '自定义']
const newLogin = ref<{ loginUrl: string; username: string; password: string; extraSteps: ExtraStep[] }>({
  loginUrl: '', username: '', password: '', extraSteps: []
})

const filteredLoginMethods = computed(() =>
  loginMethods.value.filter(m => m.type === loginType.value)
)

// 当前选中的登录方式记录（用于策略生成登录 NLP）
const currentLoginMethod = computed<LoginMethod | undefined>(() =>
  loginMethods.value.find(m => m.id === selectedLoginMethodId.value)
)

const lastRoleKey = (pid: string, type: string) => `lastLoginRole_${pid}_${type}`

const loadLoginMethods = async (pid: string) => {
  loginMethods.value = pid ? await getLoginMethods(pid) : []
  // 默认选中上次执行的角色
  const remembered = pid ? localStorage.getItem(lastRoleKey(pid, loginType.value || 'cas')) : ''
  if (remembered && loginMethods.value.some(m => m.id === remembered)) {
    selectedLoginMethodId.value = remembered
  } else {
    selectedLoginMethodId.value = ''
  }
}

watch(loginType, t => {
  if (!t || t === 'none') { selectedLoginMethodId.value = ''; return }
  const remembered = currentProjectId.value ? localStorage.getItem(lastRoleKey(currentProjectId.value, t)) : ''
  if (remembered && loginMethods.value.some(m => m.id === remembered && m.type === t)) {
    selectedLoginMethodId.value = remembered
  } else {
    selectedLoginMethodId.value = ''
  }
})

// 补充步骤（结构化）→ stepsNlp 存储文本（[动态] 前缀，与执行引擎兼容）
const extraStepsToNlp = (steps: ExtraStep[]): string => {
  return steps
    .filter(s => s.desc.trim())
    .map(s => `[动态] ${s.desc.trim()}`)
    .join('\n')
}

const savingLogin = ref(false)

// 校验新建登录账号表单，返回错误信息（null 表示通过）
const validateNewLogin = (): string | null => {
  const f = newLogin.value
  if (!f.loginUrl.trim()) return '请输入登录网址'
  if (!f.username.trim() || !f.password.trim()) return '请输入账号和密码'
  for (const s of f.extraSteps) {
    if (!s.valueType) return '请选择补充步骤的动态值类型'
    if (s.valueType === '自定义' && !s.customName.trim()) return '请输入自定义动态值名称'
    if (!s.desc.trim()) return '请填写补充步骤内容'
  }
  return null
}

// 确认保存新建登录账号（账号即角色名，点击即落库并自动选中）
const saveNewLoginMethod = async (): Promise<LoginMethod | null> => {
  const err = validateNewLogin()
  if (err) { ElMessage.warning(err); return null }
  if (!currentProjectId.value || !loginType.value || loginType.value === 'none') return null
  savingLogin.value = true
  try {
    const f = newLogin.value
    const created = await createLoginMethod({
      projectId: currentProjectId.value,
      type: loginType.value as LoginMethodType,
      name: `${loginType.value}登录-${f.username.trim()}`,
      roleName: f.username.trim(),
      loginUrl: f.loginUrl.trim(),
      username: f.username.trim(),
      password: f.password,
      stepsNlp: extraStepsToNlp(f.extraSteps) || undefined,
    })
    loginMethods.value = await getLoginMethods(currentProjectId.value)
    selectedLoginMethodId.value = created.id
    newLogin.value = { loginUrl: '', username: '', password: '', extraSteps: [] }
    localStorage.setItem(lastRoleKey(currentProjectId.value, loginType.value), created.id)
    ElMessage.success('登录账号已保存')
    return created
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.message || '保存登录账号失败')
    return null
  } finally {
    savingLogin.value = false
  }
}

// 新建表单已填写但未点"确认保存"
const hasUnsavedNewLogin = computed(() =>
  selectedLoginMethodId.value === '__NEW__' &&
  !!(newLogin.value.loginUrl.trim() || newLogin.value.username.trim() || newLogin.value.password)
)

// 确保登录方式 ID 就绪：免登录 → ''；新建未保存 → 自动保存；已选 → 原 id
const ensureLoginMethodId = async (): Promise<string | null> => {
  if (!loginType.value) { ElMessage.warning('请选择登录方式'); return null }
  if (loginType.value === 'none') {
    if (!noneUrl.value.trim()) { ElMessage.warning('请输入目标网址'); return null }
    return ''
  }

  if (selectedLoginMethodId.value === '__NEW__') {
    const created = await saveNewLoginMethod()
    return created ? created.id : null
  }

  if (!selectedLoginMethodId.value) { ElMessage.warning('请选择登录账号，或新建登录账号'); return null }
  localStorage.setItem(lastRoleKey(currentProjectId.value, loginType.value), selectedLoginMethodId.value)
  return selectedLoginMethodId.value
}

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
        // prompt 内含动态标签（【动态】/[动态]）或 AI 判定 dynamic → 该步骤不可缓存
        const hasTag = typeof step.prompt === 'string' && /^[【\[]动态[】\]]/.test(step.prompt.trim())
        const prompt = hasTag ? step.prompt.trim().replace(/^[【\[]动态[】\]]\s*/, '') : step.prompt
        yaml += `      - ${step.type}: ${prompt}\n`
        if (step.type === 'aiInput' && step.value) {
          yaml += `        value: ${step.value}\n`
        }
        if (step.dynamic || hasTag) {
          yaml += `        cacheable: false\n`
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
    // 动态标签识别：【动态】/ [动态] 前缀 → 该步骤 cacheable: false（验证码/日期/随机值等永不走缓存）
    const dynamic = /^[【\[]动态[】\]]/.test(line)
    const prompt = dynamic ? line.replace(/^[【\[]动态[】\]]\s*/, '') : line
    const taskName = prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt
    yaml += `  - name: ${taskName}\n`
    yaml += `    flow:\n`
    yaml += `      - ai: ${prompt}\n`
    if (dynamic) yaml += `        cacheable: false\n`
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

// 供智能生成 YAML / 调试使用的 NLP（登录不拼接——登录由用例绑定的登录方式在执行阶段独立完成）
const mergeNlpForGeneration = (businessNlp: string): string => {
  const nlp = businessNlp.trim()
  // 免登录：注入目标网址（确保 AI 生成 web.url，且执行时能导航）
  if (loginType.value === 'none') {
    const url = noneUrl.value.trim()
    if (!url) return nlp
    return nlp.startsWith(`打开 ${url}`) ? nlp : `打开 ${url}\n${nlp}`
  }
  return nlp
}

// 生成脚本：调 AI 拆解 NLP → 多 action 类型
const generateScript = async (nlp = generatorNlp.value) => {
  if (!nlp.trim()) { ElMessage.warning('请先输入测试指令（NLP）'); return }
  // 合并登录 NLP（策略生成）并回显到对话框，让用户可见可编辑
  const merged = mergeNlpForGeneration(nlp)
  generatorNlp.value = merged
  generatingScript.value = true; streamedScript.value = ''; streamedReasoning.value = ''; streamDialog.value = true
  try {
    const yaml = await streamNlpToYaml(merged.trim(), chunk => { streamedScript.value += chunk }, reasoning => { streamedReasoning.value += reasoning })
    streamedScript.value = yaml
  } catch (e: any) { ElMessage.error(e.message || '脚本生成失败') } finally { generatingScript.value = false }
}

// 将目标网址注入 YAML 的 web.url（免登录时确保打开用户填写的网址，而非编辑器模板默认的 baidu）
const injectUrlToYaml = (yamlContent: string, url: string): string => {
  if (!url.trim()) return yamlContent
  try {
    const doc = yamlLib.load(yamlContent) as any
    if (doc && typeof doc === 'object') {
      doc.web = doc.web || {}
      doc.web.url = url.trim()
      return yamlLib.dump(doc)
    }
  } catch { /* 解析失败走兜底 */ }
  return `web:\n  url: ${url.trim()}\ntasks:\n  - name: AI 测试\n    flow: []\n`
}

// 执行时剔除 YAML 中的登录 task（登录阶段由登录方式独立缓存执行，避免重复登录）
const stripLoginTask = (yamlContent: string): string => {
  try {
    const doc = yamlLib.load(yamlContent) as any
    if (doc?.tasks && Array.isArray(doc.tasks) && doc.tasks.length > 1) {
      const rest = doc.tasks.filter((t: any) => !/^登录/.test(String(t?.name || '')))
      if (rest.length > 0 && rest.length < doc.tasks.length) {
        return yamlLib.dump({ ...doc, tasks: rest })
      }
    }
  } catch { /* YAML 解析失败时原样返回 */ }
  return yamlContent
}

const handleGenerateScript = async () => {
  // CAS/本地：新建账号未保存时先自动保存（否则合并不到登录 NLP）；免登录：需填目标网址
  if (loginType.value && loginType.value !== 'none' && selectedLoginMethodId.value === '__NEW__') {
    const saved = await saveNewLoginMethod()
    if (!saved) return
  }
  if (loginType.value === 'none' && !noneUrl.value.trim()) {
    ElMessage.warning('请输入目标网址'); return
  }
  generatorNlp.value = nlpInstruction.value
  return generateScript()
}

// 回写业务区时剥离免登录网址前缀（保持业务步骤纯度；网址由 web.url 注入承载）
const stripUrlPrefix = (mergedNlp: string): string => {
  const nlp = mergedNlp.trim()
  if (loginType.value === 'none') {
    const url = noneUrl.value.trim()
    const prefix = `打开 ${url}`
    return url && nlp.startsWith(prefix) ? nlp.slice(prefix.length).trim() : nlp
  }
  return nlp
}

const confirmGeneratedScript = ({ nlp, yaml }: { nlp: string; yaml: string }) => {
  nlpInstruction.value = stripUrlPrefix(nlp)
  yamlContent.value = yaml
  yamlEditorRef.value?.loadFromYaml(yaml)
  streamDialog.value = false
  ElMessage.success('测试步骤和 YAML 脚本已回写')
}

onMounted(async () => {
  await Promise.all([caseStore.fetchCases(), configStore.fetchAIConfig()])
  await projectStore.fetchProjects()
})
watch(currentProjectId, async id => {
  directoryId.value = ''
  directories.value = id ? await getCaseDirectories(id) : []
  await loadLoginMethods(id)
}, { immediate: true })

const handleClear = () => { caseName.value = ''; caseDescription.value = ''; nlpInstruction.value = ''; directoryId.value = ''; yamlEditorRef.value?.reset() }

const addLog = (message: string, type: LogEntry['type'] = 'info') => {
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
  executionLogs.value.push({ time, message, type })
}

// 调试只执行当前 YAML 草稿，不创建测试用例。
const handleDebug = async (headless: boolean) => {
  if (!currentProjectId.value) { ElMessage.warning('请先在右上角选择项目'); return }
  // 登录方式校验 + 新建账号自动保存（否则调试 NLP 合并不到登录信息，浏览器不打开网址）
  const debugLoginId = await ensureLoginMethodId()
  if (debugLoginId === null) return
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
      // 调试不走登录阶段，需合并完整流程（登录/免登录网址 + 业务步骤），否则浏览器停在空白页
      nlp: mergeNlpForGeneration(nlpInstruction.value),
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
  const loginMethodId = await ensureLoginMethodId()
  if (loginMethodId === null) return
  yamlEditorRef.value?.syncFormToYaml()
  const yaml = yamlEditorRef.value?.getYamlContent() || yamlContent.value
  try {
    const created = await caseStore.addCase({
      projectId: currentProjectId.value,
      directoryId: directoryId.value,
      loginMethodId: loginMethodId || undefined,
      name: caseName.value.trim(),
      description: caseDescription.value.trim() || undefined,
      nlp: nlpInstruction.value.trim(),
      // 免登录：把用户填写的目标网址写入 web.url（否则执行已有用例时打开的是模板默认的 baidu）
      yamlFlow: loginType.value === 'none' ? injectUrlToYaml(yaml, noneUrl.value) : yaml
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
  const loginMethodId = await ensureLoginMethodId()
  if (loginMethodId === null) return
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
        loginMethodId: loginMethodId || undefined,
        name: caseName.value.trim(),
        description: caseDescription.value.trim() || undefined,
        // 免登录：NLP 需带目标网址（否则 NLP 模式不导航）；CAS/本地：保持业务步骤（登录由登录方式阶段处理）
        nlp: loginType.value === 'none' ? mergeNlpForGeneration(nlpInstruction.value) : nlpInstruction.value,
        // 非免登录时剔除 YAML 中的登录 task（登录由登录方式独立缓存执行）；免登录时注入目标网址到 web.url
        customYaml: loginMethodId ? stripLoginTask(yamlContent.value) : injectUrlToYaml(yamlContent.value, noneUrl.value),
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
    .login-role-item {
      .cache-tag {
        float: right; font-size: 12px; padding: 1px 8px; border-radius: 8px;
        &.is-cached { color: #67c23a; background: #f0f9eb; }
        &.is-uncached { color: #e6a23c; background: #fdf6ec; }
      }
      .login-new-form {
        margin-top: 12px; padding: 14px; background: #f7f9fc; border-radius: 8px;
        display: flex; flex-direction: column; gap: 10px;
        .login-new-input { width: 100%; }
        .login-field-row {
          display: flex; align-items: center; gap: 10px;
          .login-field-label { flex: 0 0 80px; font-size: 13px; color: #606266; text-align: right; }
          .login-field-input { flex: 1; }
        }
        .login-extra-step {
          padding: 10px; background: #fff; border: 1px dashed #dcdfe6; border-radius: 6px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .login-new-actions {
          display: flex; align-items: center; gap: 10px; margin-top: 4px;
          .login-save-hint { font-size: 12px; color: #909399; }
        }
      }
    }
  }
  .terminal-section { margin-top: 20px; }
  .editor-panel {
    background: #fff; border-radius: 12px; padding: 24px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  }
}
</style>
