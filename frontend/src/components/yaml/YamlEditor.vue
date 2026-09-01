<template>
  <div class="yaml-editor">
    <el-tabs v-model="activeTab" class="yaml-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="脚本编辑" name="form"><template #label><span class="tab-label"><el-icon><Edit /></el-icon>脚本编辑</span></template></el-tab-pane>
      <el-tab-pane label="YAML编辑" name="yaml"><template #label><span class="tab-label"><el-icon><Document /></el-icon>YAML编辑<el-badge v-if="yamlError" is-dot type="danger" class="error-badge" /></span></template></el-tab-pane>
    </el-tabs>

    <!-- ====== 脚本编辑区 ====== -->
    <div v-show="activeTab === 'form'" class="form-panel">

      <!-- 基础配置 -->
      <div class="base-config">
        <div class="config-row">
          <label class="config-label">目标 URL</label>
          <el-input v-model="formData.url" placeholder="https://www.example.com" size="large" class="url-input" />
        </div>
        <div class="config-row">
          <label class="config-label">超时时间</label>
          <el-input-number v-model="formData.timeout" :min="1000" :max="3600000" :step="1000" size="large" controls-position="right" class="timeout-input" />
          <span class="unit-hint">ms</span>
        </div>
      </div>

      <!-- TASK + FLOW 层级说明 -->
      <div class="hierarchy-legend">
        <div class="legend-col">
          <div class="legend-badge task-badge">TASK</div>
          <span class="legend-text">测试任务组，包含一组有序执行步骤</span>
        </div>
        <div class="legend-arrow">→</div>
        <div class="legend-col">
          <div class="legend-badge flow-badge">FLOW</div>
          <span class="legend-text">执行步骤序列，按顺序执行每个步骤</span>
        </div>
      </div>

      <!-- Tasks 列表 -->
      <div class="tasks-area">
        <TransitionGroup name="task-list">
          <div v-for="(task, ti) in formData.tasks" :key="ti" class="task-card">
            <!-- Task 头部 -->
            <div class="task-card-header" @click="toggleTaskCollapse(ti)">
              <el-icon class="task-chevron" :class="{ open: !task.collapsed }"><ArrowRight /></el-icon>
              <div class="task-ordinal">{{ ti + 1 }}</div>
              <div class="task-meta">
                <el-input v-model="task.name" placeholder="任务名称" class="task-name-inline" size="default" @click.stop />
              </div>
              <el-button type="danger" :icon="Delete" circle size="small" @click.stop="removeTask(ti)" />
            </div>

            <!-- Task 内容 -->
            <div v-show="!task.collapsed" class="task-card-body">
              <!-- 空 Flow 提示 -->
              <div v-if="!task.flow || task.flow.length === 0" class="flow-empty">
                <el-icon><CirclePlus /></el-icon>
                <span>点击下方按钮添加第一个步骤</span>
              </div>

              <!-- Flow 步骤时间线 -->
              <div class="flow-timeline">
                <TransitionGroup name="step-list">
                  <div v-for="(step, si) in task.flow" :key="si" class="flow-step">
                    <!-- 时间线连接线 -->
                    <div class="timeline-track">
                      <div class="timeline-dot" :class="step.type"></div>
                      <div v-if="si < task.flow.length - 1" class="timeline-line"></div>
                    </div>

                    <!-- 步骤卡片 -->
                    <div class="step-card">
                      <div class="step-card-header">
                        <span class="step-type-badge" :class="step.type">
                          {{ FLOW_TYPE_META[step.type]?.icon }} {{ FLOW_TYPE_META[step.type]?.label || step.type }}
                        </span>
                        <span class="step-num">#{{ si + 1 }}</span>
                        <span class="step-desc-hint" v-if="FLOW_TYPE_META[step.type]?.desc" :title="FLOW_TYPE_META[step.type].desc">
                          {{ FLOW_TYPE_META[step.type].desc }}
                        </span>
                        <!-- 类型切换 -->
                        <div class="type-changer">
                          <el-button v-for="(meta, type) in FLOW_TYPE_META" :key="type" size="small" text :class="{ active: step.type === type, 'type-btn': true, ['type-btn-' + type]: true }" @click="changeStepType(ti, si, type as any)">
                            {{ meta.icon }} {{ meta.label }}
                          </el-button>
                        </div>
                        <el-button type="danger" :icon="Delete" circle size="small" @click="removeFlowStepFromTask(ti, si)" />
                      </div>

                      <!-- 步骤主字段 -->
                      <div class="step-main-field">
                        <!-- ai / aiTap / aiAssert / aiScroll -->
                        <template v-if="step.type !== 'aiInput' && step.type !== 'sleep'">
                          <el-input v-model="step.instruction" :placeholder="getPromptPlaceholder(step.type)" @input="updateStep(ti, si, step)" />
                        </template>

                        <!-- aiInput -->
                        <template v-else-if="step.type === 'aiInput'">
                          <el-input v-model="step.instruction" placeholder="描述要输入文本的元素..." class="half-input" @input="updateStep(ti, si, step)" />
                          <el-input v-model="step.value" placeholder="输入框的最终文本内容" class="half-input" @input="updateStep(ti, si, step)" />
                        </template>

                        <!-- sleep -->
                        <template v-else-if="step.type === 'sleep'">
                          <el-input-number v-model="step.duration" :min="0" :max="300000" :step="100" controls-position="right" @change="updateStep(ti, si, step)" />
                          <span class="unit-hint">ms</span>
                        </template>
                      </div>

                      <!-- 高级选项 -->
                      <div v-if="step.type === 'ai' || step.type === 'aiAssert'" class="step-advanced">
                        <el-collapse>
                          <el-collapse-item title="高级选项">
                            <div class="advanced-grid">
                              <!-- ai -->
                              <template v-if="step.type === 'ai'">
                                <label><el-switch v-model="step.deepThink" size="small" @change="updateStep(ti, si, step)" /> 深度思考 (deepThink)</label>
                              </template>

                              <!-- aiAssert -->
                              <template v-if="step.type === 'aiAssert'">
                                <label class="full-width">断言名称 <el-input v-model="step.name" size="small" placeholder="JSON 输出 key" @input="updateStep(ti, si, step)" /></label>
                                <label class="full-width">错误提示 <el-input v-model="step.errorMessage" size="small" placeholder="断言失败时打印" @input="updateStep(ti, si, step)" /></label>
                              </template>
                            </div>
                          </el-collapse-item>
                        </el-collapse>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
              </div>

              <!-- 添加步骤按钮组 - 一级按钮 -->
              <div class="add-step-area">
                <el-button v-for="(meta, type) in FLOW_TYPE_META" :key="type" size="small" class="add-type-btn" :class="'btn-' + type" @click="addFlowStepToTask(ti, type as any)">
                  <span class="btn-icon">{{ meta.icon }}</span>{{ meta.label }}
                </el-button>
              </div>
            </div>
          </div>
        </TransitionGroup>

        <!-- 空 Task 状态 -->
        <div v-if="!formData.tasks || formData.tasks.length === 0" class="tasks-empty">
          <div class="empty-icon"><el-icon><FolderOpened /></el-icon></div>
          <p>尚无任务配置</p>
          <el-button type="primary" @click="addTask()"><el-icon><Plus /></el-icon>添加第一个 Task</el-button>
        </div>

        <!-- 添加 Task -->
        <div v-else class="add-task-row">
          <el-button @click="addTask()"><el-icon><Plus /></el-icon>添加 Task</el-button>
        </div>
      </div>

    </div>

    <!-- ====== YAML编辑区 ====== -->
    <div v-show="activeTab === 'yaml'" class="yaml-panel">
      <div class="yaml-toolbar">
        <div class="toolbar-left">
          <el-button size="small" @click="handleCopy"><el-icon><CopyDocument /></el-icon>复制</el-button>
          <el-button size="small" @click="handleDownload"><el-icon><Download /></el-icon>下载</el-button>
        </div>
        <div class="toolbar-right">
          <div class="validation-status" :class="validationStatus">
            <span v-if="validationStatus === 'valid'" class="status-indicator valid">
              <el-icon><CircleCheck /></el-icon>YAML 有效
            </span>
            <span v-else-if="validationStatus === 'warning'" class="status-indicator warning">
              <el-icon><WarningFilled /></el-icon>{{ yamlWarnings.length }} 个警告
            </span>
            <span v-else-if="validationStatus === 'error'" class="status-indicator error">
              <el-icon><CircleCloseFilled /></el-icon>YAML 错误
            </span>
            <span v-else class="status-indicator idle">
              <el-icon><Minus /></el-icon>待校验
            </span>
          </div>
        </div>
      </div>
      <div class="yaml-editor-wrap">
        <textarea v-model="yamlContent" class="yaml-textarea" :class="{ error: validationStatus === 'error', warning: validationStatus === 'warning' }" spellcheck="false" />
        <!-- 错误 / 警告面板 -->
        <div v-if="validationStatus === 'error' || validationStatus === 'warning'" class="validation-panel" :class="validationStatus">
          <div v-if="yamlError" class="validation-error-head">
            <el-icon><CircleCloseFilled /></el-icon>
            <span>{{ yamlError }}</span>
          </div>
          <TransitionGroup name="warn-list" tag="div" class="validation-warnings">
            <div v-for="(w, i) in yamlWarnings" :key="`warn-${i}`" class="warn-item">
              <span class="warn-line">L{{ w.line }}</span>
              <span class="warn-msg">{{ w.message }}</span>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit, Document, Delete, Plus, ArrowRight, CopyDocument, Download, CirclePlus, FolderOpened, CircleCheck, WarningFilled, CircleCloseFilled, Minus } from '@element-plus/icons-vue'
import type { FlowStep, FlowStepType, YamlConfig } from '@/types'
import { useYamlEditor, FLOW_TYPE_META } from '@/composables/useYamlEditor'

const props = defineProps<{ modelValue?: YamlConfig; yamlValue?: string; caseName?: string }>()
const emit = defineEmits<{ 'update:modelValue': [v: YamlConfig]; 'update:yamlValue': [v: string] }>()

const { yamlContent, formData, activeTab, yamlError, yamlWarnings, validationStatus, addTask, removeTask, toggleTaskCollapse, addFlowStepToTask, removeFlowStepFromTask, updateFlowStepInTask, loadFromYaml, copyYaml, downloadYaml, syncFormToYaml, setUrl } = useYamlEditor()

const getPromptPlaceholder = (t: string) => {
  const map: Record<string, string> = {
    ai: '描述要执行的交互任务...',
    aiTap: '描述要点击的元素...',
    aiInput: '描述要输入文本的元素...',
    aiAssert: '描述断言条件...',
    aiScroll: '描述要滚动或拖动的目标...',
  }
  return map[t] || '输入指令...'
}

const changeStepType = (ti: number, si: number, newType: FlowStepType) => {
  const tasks = formData.value.tasks; if (!tasks?.[ti]) return
  const step = tasks[ti].flow[si]
  step.type = newType
  updateStep(ti, si, step)
}

// 初始化
if (props.modelValue) { Object.assign(formData.value, props.modelValue); syncFormToYaml() }
if (props.yamlValue) loadFromYaml(props.yamlValue)

watch(formData, v => emit('update:modelValue', JSON.parse(JSON.stringify(v))), { deep: true })
watch(yamlContent, v => emit('update:yamlValue', v))

const handleTabChange = (t: string) => {
  if (t === 'yaml') {
    // 切换到 YAML 编辑：表单 → YAML
    syncFormToYaml()
  } else if (t === 'form') {
    // 切换到脚本编辑：YAML → 表单
    loadFromYaml(yamlContent.value)
  }
}
const updateStep = (ti: number, si: number, step: FlowStep) => updateFlowStepInTask(ti, si, step)

const handleCopy = async () => { const ok = await copyYaml(); ElMessage[ok ? 'success' : 'error'](ok ? '已复制' : '复制失败') }
const handleDownload = () => { downloadYaml(); ElMessage.success('下载成功') }

defineExpose({
  loadFromYaml, syncFormToYaml, setUrl,
  getYamlContent: () => yamlContent.value, getFormData: () => formData.value,
  reset: () => { formData.value = { type: 'web', url: '', timeout: 600000, tasks: [] }; yamlContent.value = '' }
})
</script>

<style lang="scss" scoped>
// ======= Design Tokens =======
$bg: #fafbfc;
$card-bg: #fff;
$border: #e8ecf1;
$border-focus: #5b8def;
$text: #1a1a2e;
$text-secondary: #6b7280;
$text-muted: #9ca3af;
$accent: #5b8def;
$accent-soft: #eef2ff;
$radius: 10px;
$shadow: 0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.06);

// Type colors
$color-planning: #8b5cf6;  // AI交互 - 紫色
$color-instant: #3b82f6;   // 点击/输入 - 蓝色
$color-query: #10b981;     // 断言 - 绿色
$color-control: #f59e0b;   // 等待 - 琥珀

.yaml-editor {
  border: 1px solid $border;
  border-radius: $radius;
  background: $bg;
  overflow: hidden;
  font-family: 'IBM Plex Sans', 'Noto Sans SC', system-ui, sans-serif;

  .yaml-tabs {
    :deep(.el-tabs__header) { margin: 0; background: #fff; border-radius: $radius $radius 0 0; padding: 0 16px; border-bottom: 1px solid $border; }
    :deep(.el-tabs__nav-wrap::after) { display: none; }
    :deep(.el-tabs__item) { height: 46px; line-height: 46px; font-size: 14px; font-weight: 500; padding: 0 18px; color: $text-secondary; }
    :deep(.el-tabs__item.is-active) { color: $accent; }
    :deep(.el-tabs__active-bar) { background: $accent; height: 2px; }
  }
  .tab-label { display: flex; align-items: center; gap: 6px; }
  .error-badge { margin-left: 4px; }
}

// ====== 脚本编辑 ======
.form-panel { padding: 20px 24px 12px; }

.base-config {
  display: flex; gap: 20px; margin-bottom: 18px;
  .config-row { display: flex; align-items: center; gap: 10px; flex: 1; }
  .config-label { font-size: 13px; font-weight: 600; color: $text-secondary; white-space: nowrap; min-width: 60px; }
  .url-input { flex: 1; }
  .timeout-input { width: 180px; }
  .unit-hint { font-size: 12px; color: $text-muted; }
}

// 层级说明
.hierarchy-legend {
  display: flex; align-items: center; gap: 16px; padding: 14px 18px;
  background: linear-gradient(135deg, #f0f4ff, #f8f9fb);
  border-radius: 8px; margin-bottom: 18px; border: 1px dashed #c7d2fe;
  .legend-col { display: flex; align-items: center; gap: 10px; flex: 1; }
  .legend-badge {
    padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: .5px;
    &.task-badge { background: #ede9fe; color: #7c3aed; }
    &.flow-badge { background: #dbeafe; color: #2563eb; }
  }
  .legend-text { font-size: 13px; color: $text-secondary; }
  .legend-arrow { font-size: 18px; color: $text-muted; font-weight: 700; }
}

// ====== Tasks ======
.tasks-area { margin-bottom: 16px; }

.task-card {
  background: $card-bg; border: 1px solid $border; border-radius: $radius;
  margin-bottom: 10px; overflow: hidden; transition: box-shadow .15s;
  &:hover { box-shadow: $shadow; }
  border-left: 3px solid $accent;
}

.task-card-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  cursor: pointer; user-select: none;
  .task-chevron { font-size: 14px; color: $text-muted; transition: transform .2s; &.open { transform: rotate(90deg); } }
  .task-ordinal {
    width: 26px; height: 26px; border-radius: 50%; background: $accent-soft; color: $accent;
    display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px;
  }
  .task-meta { display: flex; align-items: center; gap: 12px; flex: 1; }
  .task-name-inline { max-width: 260px; }
}

.task-card-body { padding: 0 14px 16px 14px; border-top: 1px solid $border; }

.flow-empty {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 28px; color: $text-muted; font-size: 13px;
}

// ====== Flow 时间线 ======
.flow-timeline { margin-top: 16px; }

.flow-step {
  display: flex; gap: 0;
  .timeline-track { display: flex; flex-direction: column; align-items: center; width: 28px; flex-shrink: 0; }
  .timeline-dot {
    width: 10px; height: 10px; border-radius: 50%; margin-top: 22px; flex-shrink: 0;
    background: $text-muted;
    &.ai { background: $color-planning; }
    &.aiTap { background: $color-instant; }
    &.aiInput { background: #f97316; }
    &.sleep { background: $color-control; }
    &.aiAssert { background: $color-query; }
    &.aiScroll { background: #06b6d4; }
  }
  .timeline-line { width: 2px; flex: 1; background: #e5e7eb; min-height: 12px; }
}

.step-card {
  flex: 1; background: $bg; border: 1px solid $border; border-radius: 8px;
  padding: 12px 14px; margin-bottom: 10px; margin-left: 8px;
}

.step-card-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;
  .step-type-badge {
    padding: 3px 10px; border-radius: 14px; font-size: 12px; font-weight: 600;
    &.ai { background: #ede9fe; color: #7c3aed; }
    &.aiTap { background: #dbeafe; color: #2563eb; }
    &.aiInput { background: #fff7ed; color: #ea580c; }
    &.sleep { background: #fef3c7; color: #d97706; }
    &.aiAssert { background: #d1fae5; color: #059669; }
    &.aiScroll { background: #cffafe; color: #0891b2; }
  }
  .step-num { font-size: 11px; color: $text-muted; font-weight: 500; }
  .step-desc-hint { font-size: 11px; color: $text-muted; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
}

.step-main-field { display: flex; align-items: center; gap: 8px; .unit-hint { font-size: 12px; color: $text-muted; } .half-input { flex: 1; } }

.step-advanced {
  margin-top: 8px;
  :deep(.el-collapse) { border: none; }
  :deep(.el-collapse-item__header) { font-size: 12px; color: $text-muted; height: 32px; line-height: 32px; border: none; background: transparent; }
  :deep(.el-collapse-item__wrap) { border: none; background: transparent; }
  :deep(.el-collapse-item__content) { padding: 8px 0 0; }
  .advanced-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;
    label { font-size: 12px; color: $text-secondary; display: flex; align-items: center; gap: 6px; }
    .full-width { grid-column: 1 / -1; }
  }
  .unit-hint-small { font-size: 11px; color: $text-muted; margin-left: 4px; }
}

// 添加步骤 - 一级按钮（不再使用下拉菜单）
.add-step-area { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 12px; padding-left: 36px; }

.add-type-btn {
  font-size: 12px;
  border-radius: 16px;
  padding: 4px 14px;
  transition: all .2s ease;
  .btn-icon { margin-right: 3px; }
  &.btn-ai       { border-color: #c4b5fd; color: #7c3aed; background: #f5f3ff; &:hover { background: #ede9fe; } }
  &.btn-aiTap    { border-color: #93c5fd; color: #2563eb; background: #eff6ff; &:hover { background: #dbeafe; } }
  &.btn-aiInput  { border-color: #fdba74; color: #ea580c; background: #fff7ed; &:hover { background: #ffedd5; } }
  &.btn-sleep    { border-color: #fcd34d; color: #d97706; background: #fffbeb; &:hover { background: #fef3c7; } }
  &.btn-aiAssert { border-color: #6ee7b7; color: #059669; background: #ecfdf5; &:hover { background: #d1fae5; } }
  &.btn-aiScroll { border-color: #67e8f9; color: #0891b2; background: #ecfeff; &:hover { background: #cffafe; } }
}

// 类型切换按钮组
.type-changer {
  display: flex; align-items: center; gap: 2px;
  margin-left: auto; flex-shrink: 0;
  .type-btn {
    font-size: 11px; padding: 1px 5px; border-radius: 10px; opacity: .45; transition: all .15s ease;
    &.active { opacity: 1; font-weight: 700; transform: scale(1.02); }
    &:not(.active):hover { opacity: .75; }
    &.type-btn-ai       { &.active { background: #ede9fe; color: #7c3aed; } }
    &.type-btn-aiTap    { &.active { background: #dbeafe; color: #2563eb; } }
    &.type-btn-aiInput  { &.active { background: #ffedd5; color: #ea580c; } }
    &.type-btn-sleep    { &.active { background: #fef3c7; color: #d97706; } }
    &.type-btn-aiAssert { &.active { background: #d1fae5; color: #059669; } }
    &.type-btn-aiScroll { &.active { background: #cffafe; color: #0891b2; } }
  }
}

// 添加 Task
.tasks-empty {
  text-align: center; padding: 40px 20px; color: $text-muted;
  .empty-icon { font-size: 40px; margin-bottom: 12px; color: #d1d5db; }
  p { font-size: 14px; margin-bottom: 16px; }
}
.add-task-row { padding: 8px 0; text-align: center; }

// ====== YAML 编辑 ======
.yaml-panel { padding: 20px 24px; }
.yaml-toolbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px;
  .toolbar-left { display: flex; gap: 8px; }
  .toolbar-right { display: flex; align-items: center; }
}
.validation-status {
  display: flex; align-items: center;
  .status-indicator {
    display: flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px;
    font-size: 12px; font-weight: 600; letter-spacing: .3px; transition: all .25s ease;
    .el-icon { font-size: 15px; }
    &.valid  { background: #ecfdf5; color: #059669; }
    &.warning { background: #fffbeb; color: #d97706; }
    &.error  { background: #fef2f2; color: #dc2626; }
    &.idle   { background: #f3f4f6; color: #9ca3af; }
  }
}
.yaml-editor-wrap { position: relative; }

.yaml-textarea {
  width: 100%; min-height: 380px; padding: 16px; font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', monospace;
  font-size: 13px; line-height: 1.7; border: 2px solid #d1d5db; border-radius: 8px; resize: vertical;
  background: #1a1b26; color: #a9b1d6; transition: border-color .3s ease, box-shadow .3s ease;
  &:focus { outline: none; border-color: $border-focus; box-shadow: 0 0 0 3px rgba(91,141,239,.15); }
  &.error {
    border-color: #ef4444;
    &:focus { box-shadow: 0 0 0 3px rgba(239,68,68,.15); }
  }
  &.warning {
    border-color: #f59e0b;
    &:focus { box-shadow: 0 0 0 3px rgba(245,158,11,.15); }
  }
}

// ====== 校验面板 ======
.validation-panel {
  margin-top: 10px; border-radius: 8px; overflow: hidden;
  border: 1px solid;
  transition: all .3s ease;
  &.error {
    background: #fef2f2; border-color: #fecaca;
  }
  &.warning {
    background: #fffbeb; border-color: #fde68a;
  }
}
.validation-error-head {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  font-size: 13px; font-weight: 600;
  color: #dc2626; border-bottom: 1px solid #fecaca;
  .el-icon { font-size: 16px; flex-shrink: 0; }
}
.validation-warnings {
  padding: 6px 0;
  .warn-item {
    display: flex; align-items: baseline; gap: 10px; padding: 6px 14px;
    font-size: 12px; line-height: 1.6;
    transition: background .15s ease;
    &:hover { background: rgba(0,0,0,.03); }
    &:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,.04); }
  }
  .warn-line {
    flex-shrink: 0; min-width: 32px; padding: 1px 6px;
    border-radius: 4px; font-family: 'JetBrains Mono', monospace;
    font-size: 11px; font-weight: 700; text-align: center;
    background: rgba(245,158,11,.15); color: #92400e;
  }
  .warn-msg { color: #78350f; }
}

// 警告列表动画
.warn-list-enter-active { transition: all .3s ease; }
.warn-list-leave-active { transition: all .2s ease; }
.warn-list-enter-from { opacity: 0; transform: translateX(-8px); }
.warn-list-leave-to { opacity: 0; transform: translateX(8px); }

// ====== 动画 ======
.task-list-enter-active, .task-list-leave-active { transition: all .25s ease; }
.task-list-enter-from, .task-list-leave-to { opacity: 0; transform: translateY(-8px); }
.step-list-enter-active, .step-list-leave-active { transition: all .2s ease; }
.step-list-enter-from, .step-list-leave-to { opacity: 0; transform: translateX(-12px); }
</style>
