<template>
  <el-dialog
    :model-value="modelValue"
    title="AI 生成脚本"
    width="96%"
    top="4vh"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="generator-layout">
      <section class="generator-panel">
        <h3>测试步骤原文</h3>
        <el-input v-model="editableNlp" type="textarea" :rows="22" :disabled="generating" placeholder="请输入测试步骤" />
      </section>
      <section class="generator-panel reasoning-panel">
        <h3>大模型思考过程</h3>
        <div class="reasoning-markdown" v-html="renderedReasoning" />
      </section>
      <section class="generator-panel yaml-panel">
        <h3>模型输出 YAML</h3>
        <el-input v-model="editableYaml" type="textarea" :rows="22" :disabled="generating" placeholder="模型生成的 YAML 将显示在这里" />
      </section>
    </div>
    <template #footer>
      <span v-if="generating" class="generation-status">正在实时生成…</span>
      <el-button :loading="generating" :disabled="!editableNlp.trim()" @click="emit('regenerate', editableNlp)">重新生成</el-button>
      <el-button type="primary" :disabled="generating || !editableYaml.trim()" @click="emit('confirm', { nlp: editableNlp, yaml: editableYaml })">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: boolean
  nlp: string
  reasoning: string
  yaml: string
  generating: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:nlp': [value: string]
  'update:yaml': [value: string]
  regenerate: [nlp: string]
  confirm: [value: { nlp: string; yaml: string }]
}>()

const editableNlp = computed({ get: () => props.nlp, set: value => emit('update:nlp', value) })
const editableYaml = computed({ get: () => props.yaml, set: value => emit('update:yaml', value) })
const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const renderedReasoning = computed(() => {
  const source = props.reasoning || (props.generating ? '正在思考…' : '暂无思考过程')
  const escaped = escapeHtml(source)
  return escaped
    .replace(/```(?:\w+)?\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.*)$/gm, '• $1')
    .replace(/\n/g, '<br>')
})
</script>

<style scoped lang="scss">
.generator-layout { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.generator-panel { min-width: 0; }
.generator-panel h3 { margin: 0 0 10px; font-size: 15px; color: #303133; }
.reasoning-markdown { min-height: 492px; max-height: 492px; overflow: auto; box-sizing: border-box; padding: 11px 15px; border: 1px solid #dcdfe6; border-radius: 4px; background: #f5f7fa; color: #606266; line-height: 1.6; white-space: normal; }
.reasoning-markdown :deep(pre) { overflow: auto; padding: 10px; border-radius: 4px; background: #282c34; color: #f8f8f2; }
.reasoning-markdown :deep(code) { padding: 1px 4px; border-radius: 3px; background: #e9edf2; font-family: Consolas, Monaco, monospace; }
.reasoning-markdown :deep(pre code) { padding: 0; background: transparent; }
.reasoning-markdown :deep(h1), .reasoning-markdown :deep(h2), .reasoning-markdown :deep(h3) { margin: 8px 0; color: #303133; }
.yaml-panel :deep(textarea) { font-family: Consolas, Monaco, monospace; }
.generation-status { margin-right: 12px; color: #909399; }
@media (max-width: 1000px) { .generator-layout { grid-template-columns: 1fr; } }
</style>
