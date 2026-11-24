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
        <el-button type="info" plain @click="viewRecordedScript">
          <el-icon><DocumentCopy /></el-icon>录制脚本
        </el-button>
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
            <div class="info-item">
              <span class="info-label">登录方式</span>
              <span class="info-value">
                <template v-if="currentLoginMethod">
                  {{ currentLoginMethod.type === 'cas' ? 'CAS 登录' : '本地登录' }}（{{ currentLoginMethod.username }}）
                  <el-tag size="small" :type="currentLoginMethod.cacheStatus === 'cached' ? 'success' : 'warning'" style="margin-left:6px">
                    {{ currentLoginMethod.cacheStatus === 'cached' ? '已缓存' : '未缓存' }}
                  </el-tag>
                </template>
                <el-tag v-else size="small" type="info">免登录</el-tag>
                <el-button :icon="Edit" size="small" text class="login-edit-btn" @click="openLoginDialog">编辑</el-button>
              </span>
            </div>
            <div class="info-item"><span class="info-label">执行状态</span><el-tag :type="getStatusType((detail as any).status)" size="small">{{ getStatusName((detail as any).status) }}</el-tag></div>
            <div v-if="(detail as any).description" class="info-item"><span class="info-label">用例描述</span><span class="info-value">{{ (detail as any).description }}</span></div>
            <div class="info-item"><span class="info-label">创建时间</span><span class="info-value">{{ formatDateTime((detail as any).createdAt) }}</span></div>
          </div>
        </div>

        <div class="info-card mt-20">
          <h3 class="card-title"><el-icon><ChatLineSquare /></el-icon>NLP测试步骤</h3>
          <el-input v-model="nlpText" type="textarea" :rows="5" placeholder="输入NLP测试指令" />
          <el-radio-group v-model="executionMode" style="margin-top:10px"><el-radio-button label="NLP">案例描述执行</el-radio-button><el-radio-button label="YAML">YAML 脚本执行</el-radio-button><el-radio-button label="CODE" :disabled="(detail as any).scriptStatus !== 'RECORDED'">代码执行</el-radio-button></el-radio-group>
          <div v-if="(detail as any).scriptStatus !== 'RECORDED'" class="code-mode-hint">
            代码执行需先以 NLP/YAML 模式执行成功并自动录制脚本{{ (detail as any).scriptStatus === 'STALE' ? '（当前录制脚本已过期：NLP/YAML 已修改，需重新录制）' : '（该用例尚未录制）' }}
          </div>
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
    <el-dialog v-model="recordedScriptDialog" title="录制的 Playwright 脚本" width="880px" top="5vh" :close-on-click-modal="false">
      <div class="recorded-script-body">
        <el-alert
          v-if="(detail as any).scriptStatus === 'STALE'"
          type="warning"
          :closable="false"
          show-icon
          style="margin-bottom:10px"
          title="录制脚本已过期：NLP/YAML 内容已修改。请以 NLP/YAML 模式重新执行成功以重新录制，代码执行暂不可用。"
        />
        <el-alert
          v-if="(detail as any).script"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom:10px"
          title="脚本可直接编辑并保存，保存后将原样下发执行机以 CODE 模式运行（不经过录制校验，请确认内容安全）"
        />
        <el-descriptions :column="2" border size="small" style="margin-bottom:12px">
          <el-descriptions-item label="脚本状态">
            <el-tag size="small" :type="scriptStatusConfig.type">{{ scriptStatusConfig.label }}</el-tag>
            <el-tag v-if="recordedScriptDirty" size="small" type="danger" style="margin-left:4px">未保存</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="录制时间">{{ formatDateTime((detail as any).scriptRecordedAt) }}</el-descriptions-item>
          <el-descriptions-item label="源执行 ID">{{ (detail as any).scriptSourceExecutionId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="脚本大小">{{ recordedScriptSize }}</el-descriptions-item>
        </el-descriptions>
        <div class="rs-toolbar">
          <span class="rs-legend">登录阶段不录制（执行时由登录方式完成）；<code>stp.ai / aiAssert / aiWaitFor</code> 调用为 @ai 步骤（复杂断言/动态值，执行时走 Midscene）；其余步骤为纯 Playwright 代码，定位失败时由 Midscene 以步骤语义兜底。</span>
          <el-button size="small" text type="primary" @click="copyText(recordedScriptDraft)">复制</el-button>
        </div>
        <CodeViewer v-if="(detail as any).script" v-model:code="recordedScriptDraft" editable height="52vh" />
        <el-empty v-else description="尚无录制脚本：以 NLP/YAML 模式执行成功后将自动录制并关联到本用例" :image-size="80" />
      </div>
      <template #footer>
        <el-button @click="recordedScriptDialog = false">关闭</el-button>
        <el-button type="primary" :loading="savingScript" :disabled="!recordedScriptDirty" @click="saveRecordedScript">
          保存修改
        </el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="loginDialog" title="登录方式管理" width="680px" :close-on-click-modal="false">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom:14px"
        title="修改登录信息（网址/账号/密码/补充步骤）后，原登录缓存将失效，下次执行时重新登录生成新缓存"
      />
      <el-form label-width="92px" label-position="left">
        <el-form-item label="绑定登录方式">
          <el-select v-model="loginSelectedId" style="width:100%" placeholder="选择登录方式">
            <el-option value="" label="免登录（不执行登录阶段）" />
            <el-option v-for="m in bindableLoginMethods" :key="m.id" :value="m.id" :label="m.username || m.name">
              <span>{{ m.type === 'cas' ? 'CAS 登录' : '本地登录' }} · {{ m.username || m.name }}</span>
              <el-tag size="small" :type="m.cacheStatus === 'cached' ? 'success' : 'warning'" style="margin-left:8px">
                {{ m.cacheStatus === 'cached' ? '已缓存' : '未缓存' }}
              </el-tag>
            </el-option>
            <el-option value="__NEW__" label="➕ 新建登录方式…" />
          </el-select>
        </el-form-item>
        <template v-if="loginSelectedId">
          <div class="login-form-divider">{{ loginSelectedId === '__NEW__' ? '新建登录方式信息' : '登录方式信息' }}</div>
          <el-form-item label="类型">
            <el-radio-group v-model="loginForm.type">
              <el-radio label="cas">CAS 登录</el-radio>
              <el-radio label="local">本地登录</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="登录网址">
            <el-input v-model="loginForm.loginUrl" placeholder="例如：https://sso.example.com/login" />
          </el-form-item>
          <el-form-item label="账号">
            <el-input v-model="loginForm.username" placeholder="登录账号" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input v-model="loginForm.password" show-password placeholder="登录密码" />
          </el-form-item>
          <el-form-item label="补充步骤">
            <div class="login-extra-steps">
              <div v-for="(s, i) in loginForm.extraSteps" :key="i" class="login-extra-step-row">
                <el-select v-model="s.valueType" placeholder="动态值类型" size="small" style="width:150px">
                  <el-option v-for="opt in dynamicValueOptions" :key="opt" :label="opt" :value="opt" />
                </el-select>
                <el-input v-if="s.valueType === '自定义'" v-model="s.customName" size="small" placeholder="动态值名称" style="width:140px" />
                <el-input v-model="s.desc" size="small" placeholder="该动态值的处理步骤，如：识别图形验证码并填入" style="flex:1" />
                <el-button type="danger" link size="small" @click="loginForm.extraSteps.splice(i, 1)">删除</el-button>
              </div>
              <el-button type="primary" link size="small" @click="loginForm.extraSteps.push({ valueType: '', customName: '', desc: '' })">
                ➕ 新增补充步骤（验证码等动态值，执行时不缓存）
              </el-button>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <div class="login-dialog-footer">
          <el-button
            v-if="loginSelectedId && loginSelectedId !== '__NEW__'"
            type="danger"
            plain
            :loading="loginDeleting"
            @click="removeLoginMethod"
          >删除该登录方式</el-button>
          <div class="login-dialog-footer-right">
            <el-button type="primary" :loading="loginSaving" @click="applyLoginChanges">
              {{ loginSelectedId === '' ? '确认换绑' : loginSelectedId === '__NEW__' ? '保存并绑定' : '保存并应用' }}
            </el-button>
            <el-button @click="loginDialog = false">关闭</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
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
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { InfoFilled, ChatLineSquare, Tickets, Edit, Document, VideoPlay, DocumentCopy } from '@element-plus/icons-vue'
import { YamlEditor } from '@/components/yaml'
import { CodeViewer } from '@/components/code'
import { AiScriptGeneratorDialog } from '@/components/common'
import { useCaseStore, useConfigStore } from '@/stores'
import { getCase, getCaseCache, updateCase, streamNlpToYaml } from '@/api'
import { getLoginMethods, createLoginMethod, updateLoginMethod, deleteLoginMethod, type LoginMethod, type LoginMethodType } from '@/api/cases'
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
const executionMode = ref<'NLP' | 'YAML' | 'CODE'>('NLP')
const executionLogs = ref<Array<{ time: string; message: string; type: string }>>([])
const cacheDialog = ref(false)
const cacheText = ref('')
const viewCache = async () => { try { cacheText.value = await getCaseCache(String(route.params.id)); cacheDialog.value = true } catch { ElMessage.info('该用例暂无缓存文件') } }

// ── 录制脚本状态展示 ──
const scriptStatusConfig = computed(() => {
  const s = (detail.value as any)?.scriptStatus || 'NONE'
  const map: Record<string, { label: string; type: string }> = {
    RECORDED: { label: '已录制', type: 'success' },
    STALE: { label: '已过期', type: 'warning' },
    NONE: { label: '未录制', type: 'info' },
  }
  return map[s] || map.NONE
})
const recordedScriptSize = computed(() => {
  const s = (detail.value as any)?.script || ''
  return s ? `${(new Blob([s]).size / 1024).toFixed(1)} KB（${s.split('\n').length} 行）` : '-'
})

// ── 最终下发执行机的 Midscene 脚本预览 ──（已移除入口，保留 getFinalScript API 供后续使用）

// ── 录制脚本（NLP/YAML 执行成功后自动生成并关联的 Playwright 重放脚本；支持编辑保存） ──
const recordedScriptDialog = ref(false)
const recordedScriptDraft = ref('')
const savingScript = ref(false)
const recordedScriptDirty = computed(() => recordedScriptDraft.value !== ((detail.value as any)?.script || ''))
const viewRecordedScript = () => {
  recordedScriptDraft.value = (detail.value as any)?.script || ''
  recordedScriptDialog.value = true
}
const saveRecordedScript = async () => {
  const id = (detail.value as any)?.id
  if (!id) { ElMessage.warning('无用例ID'); return }
  const script = recordedScriptDraft.value
  if (!script.trim()) { ElMessage.warning('脚本内容不能为空'); return }
  savingScript.value = true
  try {
    const updated = await updateCase(String(id), { script })
    detail.value = { ...detail.value, ...(updated || {}), script }
    ElMessage.success('录制脚本已保存（将以 CODE 模式原样下发执行机运行）')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.message || '保存失败')
  } finally { savingScript.value = false }
}
const copyText = async (text: string) => {
  try { await navigator.clipboard.writeText(text); ElMessage.success('已复制到剪贴板') }
  catch { ElMessage.warning('复制失败，请手动选择复制') }
}

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

// ── 登录方式（基本信息展示；生成脚本不拼接登录——登录由用例绑定的登录方式在执行阶段独立完成） ──
const loginMethods = ref<LoginMethod[]>([])
const currentLoginMethod = computed<LoginMethod | undefined>(() =>
  loginMethods.value.find(m => m.id === (detail.value as any)?.loginMethodId)
)

// ── 登录方式管理（换绑/解绑、编辑内容、新建并绑定、删除） ──
interface ExtraStep { valueType: string; customName: string; desc: string }
const dynamicValueOptions = ['图形验证码', '短信验证码', '滑块验证', '邮件验证码', '自定义']
// none 类型记录无绑定意义（免登录 = 解绑），下拉不列出
const bindableLoginMethods = computed(() => loginMethods.value.filter(m => m.type !== 'none'))
const loginDialog = ref(false)
const loginSelectedId = ref('')
const loginSaving = ref(false)
const loginDeleting = ref(false)
const loginForm = ref<{ type: LoginMethodType; loginUrl: string; username: string; password: string; extraSteps: ExtraStep[] }>({
  type: 'local', loginUrl: '', username: '', password: '', extraSteps: []
})

// stepsNlp（"[动态] xxx" 行）↔ 结构化补充步骤（与创建页同格式；valueType 仅为录入辅助不入库，反解统一置"自定义"）
const stepsNlpToExtra = (stepsNlp?: string): ExtraStep[] =>
  (stepsNlp || '').split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => ({ valueType: '自定义', customName: '', desc: l.replace(/^\[动态\]\s*/, '') }))
const extraStepsToNlp = (steps: ExtraStep[]): string =>
  steps.filter(s => s.desc.trim()).map(s => `[动态] ${s.desc.trim()}`).join('\n')

const fillLoginForm = (m?: LoginMethod) => {
  loginForm.value = m
    ? { type: m.type, loginUrl: m.loginUrl || '', username: m.username || '', password: m.password || '', extraSteps: stepsNlpToExtra(m.stepsNlp) }
    : { type: 'local', loginUrl: '', username: '', password: '', extraSteps: [] }
}

watch(loginSelectedId, id => {
  if (id === '__NEW__') fillLoginForm()
  else if (id) fillLoginForm(loginMethods.value.find(m => m.id === id))
})

const openLoginDialog = () => {
  loginSelectedId.value = (detail.value as any)?.loginMethodId || ''
  loginDialog.value = true
}

const validateLoginForm = (): string | null => {
  const f = loginForm.value
  if (!f.loginUrl.trim()) return '请输入登录网址'
  if (!f.username.trim() || !f.password.trim()) return '请输入账号和密码'
  for (const s of f.extraSteps) {
    if (!s.desc.trim()) continue
    if (!s.valueType) return '请选择补充步骤的动态值类型'
    if (s.valueType === '自定义' && !s.customName.trim()) return '请输入自定义动态值名称'
  }
  return null
}

const reloadLoginMethods = async () => {
  const pid = (detail.value as any)?.projectId
  if (pid) { try { loginMethods.value = await getLoginMethods(pid) } catch { /* 刷新失败不阻断 */ } }
}

// 保存登录方式内容载荷（name/roleName 随账号同步，与创建页语义一致；不传 cacheStatus，由后端按内容变更决定重置）
const buildMethodPayload = () => {
  const f = loginForm.value
  return {
    type: f.type,
    name: `${f.type}登录-${f.username.trim()}`,
    roleName: f.username.trim(),
    loginUrl: f.loginUrl.trim(),
    username: f.username.trim(),
    password: f.password,
    stepsNlp: extraStepsToNlp(f.extraSteps) || undefined
  }
}

const applyLoginChanges = async () => {
  const caseId = (detail.value as any)?.id
  if (!caseId) { ElMessage.warning('无用例ID'); return }
  const selected = loginSelectedId.value

  // 免登录：解绑
  if (selected === '') {
    if (!(detail.value as any)?.loginMethodId) { loginDialog.value = false; return }
    loginSaving.value = true
    try {
      const updated = await updateCase(String(caseId), { loginMethodId: '' })
      detail.value = { ...detail.value, ...(updated || {}), loginMethodId: '' }
      ElMessage.success('已解绑，该用例将免登录执行')
      loginDialog.value = false
    } catch (e: any) { ElMessage.error(e?.response?.data?.error || e?.message || '解绑失败') } finally { loginSaving.value = false }
    return
  }

  const err = validateLoginForm()
  if (err) { ElMessage.warning(err); return }
  loginSaving.value = true
  try {
    if (selected === '__NEW__') {
      const pid = (detail.value as any)?.projectId
      if (!pid) { ElMessage.warning('缺少项目信息，无法新建登录方式'); return }
      const created = await createLoginMethod({ projectId: String(pid), ...buildMethodPayload() })
      const updated = await updateCase(String(caseId), { loginMethodId: created.id })
      detail.value = { ...detail.value, ...(updated || {}), loginMethodId: created.id }
      await reloadLoginMethods()
      ElMessage.success('登录方式已创建并绑定该用例')
    } else {
      await updateLoginMethod(selected, buildMethodPayload())
      if ((detail.value as any)?.loginMethodId !== selected) {
        const updated = await updateCase(String(caseId), { loginMethodId: selected })
        detail.value = { ...detail.value, ...(updated || {}), loginMethodId: selected }
      }
      await reloadLoginMethods()
      ElMessage.success('登录方式已保存（登录信息若有变更，原缓存失效，下次执行重新登录）')
    }
    loginDialog.value = false
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.message || '保存失败')
  } finally { loginSaving.value = false }
}

const removeLoginMethod = async () => {
  const methodId = loginSelectedId.value
  const caseId = (detail.value as any)?.id
  if (!methodId || methodId === '__NEW__' || !caseId) return
  try {
    await ElMessageBox.confirm(
      '删除后不可恢复；若同项目其他用例也绑定了该登录方式，删除将被拒绝。当前用例如有绑定将先解绑。确认删除？',
      '删除登录方式',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch { return }
  loginDeleting.value = true
  try {
    if ((detail.value as any)?.loginMethodId === methodId) {
      const updated = await updateCase(String(caseId), { loginMethodId: '' })
      detail.value = { ...detail.value, ...(updated || {}), loginMethodId: '' }
    }
    await deleteLoginMethod(methodId)
    await reloadLoginMethods()
    loginSelectedId.value = ''
    ElMessage.success('登录方式已删除')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.message || '删除失败')
    await reloadLoginMethods()
  } finally { loginDeleting.value = false }
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
    const savedMode = (res as any)?.executionMode
    executionMode.value = savedMode === 'YAML' ? 'YAML'
      : (savedMode === 'CODE' && (res as any)?.scriptStatus === 'RECORDED' ? 'CODE' : 'NLP')
    nlpText.value = cleanNlp((res as any)?.nlp || '')
    // 加载登录方式（生成脚本拼登录 NLP + 基本信息展示）
    if ((res as any)?.projectId) {
      try { loginMethods.value = await getLoginMethods((res as any).projectId) } catch { loginMethods.value = [] }
    }

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
  if (mode === 'CODE') {
    const id = (detail.value as any)?.id
    if (!id) { ElMessage.warning('无用例ID'); return }
    if ((detail.value as any).scriptStatus !== 'RECORDED') { ElMessage.warning('录制脚本不可用，请先以 NLP/YAML 模式执行成功生成录制脚本'); return }
    executing.value = true
    try {
      const r: any = await caseStore.runCase(id, undefined, configStore.aiConfig.browserMode === 'headless', 'CODE')
      if (r?.executionId) ElMessage.success('CODE 执行任务已提交')
      else ElMessage.error(r?.response?.data?.error || r?.errorDetail || '执行失败')
    } finally { executing.value = false }
    return
  }
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
        .login-edit-btn { padding: 2px 6px; margin-left: 6px; }
      }
    }
  }
  .login-form-divider { font-size: 14px; font-weight: 600; color: #303133; margin: 6px 0 14px; padding-bottom: 10px; border-bottom: 1px dashed #e8ecf1; }
  .login-extra-steps { width: 100%;
    .login-extra-step-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  }
  .login-dialog-footer { display: flex; justify-content: space-between; align-items: center;
    .login-dialog-footer-right { display: flex; gap: 0; }
  }
  .code-mode-hint { font-size: 12px; color: #E6A23C; margin-top: 6px; line-height: 1.6; }
  .recorded-script-body {
    .rs-toolbar { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px;
      .rs-legend { font-size: 12px; color: #909399; line-height: 1.7; flex: 1;
        code { background: #f0f2f5; padding: 0 4px; border-radius: 3px; font-family: Consolas, monospace; }
      }
    }
  }
  .editor-card { background: #fff; border-radius: 10px; padding: 24px; box-shadow: 0 2px 16px rgba(0,0,0,0.06); }
}

</style>
<style lang="scss">.stream-markdown{height:62vh;overflow:auto;padding:18px;background:#15181d;color:#e6edf3;border-radius:8px;font:14px/1.7 Consolas,monospace}.stream-markdown pre{padding:14px;background:#0d1117;border-radius:6px;overflow:auto}.stream-markdown code{color:#a5d6ff}.stream-markdown h1,.stream-markdown h2,.stream-markdown h3{color:#79c0ff}</style>
