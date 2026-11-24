<template>
  <div ref="containerRef" class="code-viewer" :style="{ height }"></div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

/**
 * 代码查看/编辑器（CodeMirror 6 + one-dark 主题 + TS 语法高亮）
 * - 默认只读；editable 时可编辑并通过 v-model:code 双向同步草稿内容
 * - 外部 code 变化（如保存后回写）时增量刷新文档
 */
const props = withDefaults(defineProps<{
  code?: string
  height?: string
  editable?: boolean
}>(), {
  code: '',
  height: '420px',
  editable: false,
})

const emit = defineEmits<{ (e: 'update:code', value: string): void }>()

const containerRef = ref<HTMLElement>()
let view: EditorView | null = null

const createState = (doc: string) => EditorState.create({
  doc,
  extensions: [
    basicSetup,
    javascript({ typescript: true }),
    oneDark,
    // 编辑模式开放输入；只读模式锁定
    ...(props.editable ? [] : [EditorState.readOnly.of(true), EditorView.editable.of(false)]),
    // 草稿双向同步（v-model:code）
    EditorView.updateListener.of((v) => {
      if (v.docChanged) emit('update:code', v.state.doc.toString())
    }),
  ],
})

onMounted(() => {
  if (containerRef.value) {
    view = new EditorView({
      state: createState(props.code || ''),
      parent: containerRef.value,
    })
  }
})

watch(() => props.code, (next) => {
  if (!view) return
  const current = view.state.doc.toString()
  if (next !== current) {
    view.dispatch({ changes: { from: 0, to: current.length, insert: next || '' } })
  }
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<style scoped>
.code-viewer {
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
}
.code-viewer :deep(.cm-editor) {
  height: 100%;
  font-size: 13px;
}
.code-viewer :deep(.cm-scroller) {
  font-family: Consolas, 'Courier New', monospace;
  line-height: 1.6;
}
</style>
