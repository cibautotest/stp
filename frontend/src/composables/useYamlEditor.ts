import { ref, watch } from 'vue'
import yaml from 'js-yaml'
import type { FlowStep, TaskItem } from '@/types'

// 防抖
export const useDebounce = <T>(fn: (...args: any[]) => T, delay: number) => {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: any[]) => { if (timer) clearTimeout(timer); timer = setTimeout(() => fn(...args), delay) }
}

// FLOW 类型元信息
export const FLOW_TYPE_META: Record<string, { label: string; icon: string; desc: string; category: string }> = {
  ai:       { label: 'AI 交互',     icon: '🧠', desc: '自动规划执行交互任务，aiAct 的简写',  category: 'interact' },
  aiTap:    { label: '点击元素',     icon: '👆', desc: '点击 prompt 描述的元素',              category: 'tap' },
  aiInput:  { label: '输入文本',     icon: '⌨️', desc: '向 prompt 描述的元素输入文本',         category: 'input' },
  aiHover:  { label: '悬停元素',     icon: '🖱️', desc: '悬停在 prompt 描述的元素上',           category: 'interact' },
  aiKeyboardPress: { label: '按键',  icon: '⌨️', desc: '按下指定按键或组合键',                  category: 'interact' },
  sleep:    { label: '等待',         icon: '⏱️', desc: '暂停执行指定毫秒数',                  category: 'wait' },
  aiWaitFor:{ label: '等待条件',     icon: '⏳', desc: '等待 prompt 描述的页面状态',            category: 'wait' },
  aiAssert: { label: '断言',         icon: '✅', desc: 'AI 验证页面状态是否符合预期',         category: 'assert' },
  aiScroll: { label: '拖动/滚动',    icon: '📜', desc: '滚动或拖动页面',                      category: 'scroll' },
  aiQuery:  { label: '数据提取',     icon: '🔎', desc: '提取 prompt 描述的数据',               category: 'interact' },
  javascript:{ label: '执行脚本',    icon: '🧩', desc: '执行 JavaScript 代码',                 category: 'interact' },
  recordToReport: { label: '记录报告', icon: '📷', desc: '将内容记录到测试报告',                category: 'interact' },
}

// 步骤类型分类
export const FLOW_CATEGORIES: Record<string, { title: string; desc: string; types: string[] }> = {
  interact: { title: 'AI 交互', desc: 'AI 自动规划完成交互任务', types: ['ai'] },
  tap:      { title: '点击',     desc: '点击或输入元素',         types: ['aiTap', 'aiInput'] },
  wait:     { title: '等待',     desc: '暂停执行',               types: ['sleep'] },
  assert:   { title: '断言',     desc: '验证页面状态',           types: ['aiAssert'] },
  scroll:   { title: '滚动',     desc: '拖动或滚动页面',         types: ['aiScroll'] },
}

// YAML编辑器核心逻辑
export const useYamlEditor = () => {
  const yamlContent = ref('')
  const formData = ref<YamlConfig>({ type: 'web', url: '', timeout: 600000, tasks: [] })
  const activeTab = ref<'form' | 'yaml'>('form')
  const yamlError = ref('')
  const yamlWarnings = ref<Array<{ line: number; message: string }>>([])
  const isUpdating = ref(false)
  const validationStatus = ref<'idle' | 'valid' | 'warning' | 'error'>('idle')

  // 表单 → YAML
  const syncFormToYaml = () => {
    try {
      const type = formData.value.type || 'web'
      const url = formData.value.url || ''
      const tasks = formData.value.tasks || []

      let s = ''
      s += `${type}:\n`
      if (url) s += `  url: ${url}\n`
      s += `  timeout: ${formData.value.timeout ?? 600000}\n`
      s += `\ntasks:\n`

      if (tasks.length === 0) {
        s += `  - name: task\n    flow: []\n`
      } else {
        tasks.forEach(task => {
          s += `  - name: ${task.name || 'task'}\n`
          if (task.continueOnError) s += `    continueOnError: true\n`
          s += `    flow:\n`
          if (task.flow && task.flow.length > 0) {
            task.flow.forEach(step => { s += stepToYaml(step) })
          } else {
            s += `      []\n`
          }
        })
      }
      yamlContent.value = s
      yamlError.value = ''
    } catch (e: any) { yamlError.value = e.message }
  }

  // 单步 → YAML 行（返回新字符串）
  const stepToYaml = (step: FlowStep): string => {
    const t = step.type
    const indent = '      '

    const mkKey = (key: string, val: string | number | boolean | null | undefined, quote = false): string => {
      if (val == null || val === '' || val === false) return ''
      const v = quote ? `"${val}"` : String(val)
      return `${indent}  ${key}: ${v}\n`
    }

    let out = ''
    if (t === 'ai' && step.instruction) {
      out += `${indent}- ai: ${step.instruction}\n`
      out += mkKey('deepThink', step.deepThink)
    } else if (t === 'aiTap' && step.instruction) {
      out += `${indent}- aiTap:\n`
      out += `${indent}    target: ${step.instruction}\n`
    } else if (t === 'aiInput' && step.instruction) {
      out += `${indent}- aiInput:\n`
      out += `${indent}    target: ${step.instruction}\n`
      if (step.value) out += `${indent}    action: ${step.value}\n`
    } else if (t === 'sleep') {
      out += `${indent}- sleep: ${step.duration ?? 1000}\n`
    } else if (t === 'aiAssert' && step.instruction) {
      out += `${indent}- aiAssert: ${step.instruction}\n`
      if (step.errorMessage) out += mkKey('errorMessage', step.errorMessage, true)
      if (step.name) out += mkKey('name', step.name, true)
    } else if (step.instruction) {
      out += `${indent}- ${t}: ${step.instruction}\n`
    }
    return out
  }

  // YAML → 表单
  const syncYamlToForm = () => {
    try {
      const content = yamlContent.value
      try {
        const parsed = yaml.load(content) as any
        if (parsed) {
          const type = parsed.web ? 'web' : parsed.task ? 'task' : parsed.flow ? 'flow' : 'web'
          formData.value.type = type as any
          if (parsed.web?.url) formData.value.url = parsed.web.url
          else if (parsed[type]?.url) formData.value.url = parsed[type].url
          if (parsed.web?.timeout != null) formData.value.timeout = Number(parsed.web.timeout)
          else if (parsed[type]?.timeout != null) formData.value.timeout = Number(parsed[type].timeout)

          if (parsed.tasks && Array.isArray(parsed.tasks)) {
            formData.value.tasks = parsed.tasks.map((t: any) => ({
              name: t.name || 'task',
              continueOnError: t.continueOnError === true,
              flow: Array.isArray(t.flow)
                ? t.flow.map((item: any, i: number) => yamlItemToStep(item, i))
                : []
            }))
          }
          yamlError.value = ''
          return
        }
      } catch {}
      const um = content.match(/url:\s*(.+)/)
      if (um) formData.value.url = um[1].trim()
      yamlError.value = ''
    } catch (e: any) { yamlError.value = e.message }
  }

  // 单 YAML item → FlowStep
  const yamlItemToStep = (item: any, i: number): FlowStep => {
    if (!item || typeof item !== 'object') return { type: 'ai', instruction: '', index: i }

    const readPrompt = (value: any): string => {
      if (typeof value === 'string' || typeof value === 'number') return String(value)
      if (value && typeof value === 'object') {
        return String(
          value.target ??
          value.prompt ??
          value.instruction ??
          value.label ??
          value.text ??
          value.value ??
          ''
        )
      }
      return ''
    }

    const readInputValue = (value: any): string | undefined => {
      if (typeof value === 'string' || typeof value === 'number') return String(value)
      if (value && typeof value === 'object') {
        return String(
          value.action ??
          value.value ??
          value.text ??
          value.content ??
          value.input ??
          value.prompt ??
          ''
        ) || undefined
      }
      return undefined
    }

    const base = (type: FlowStep['type'], instruction?: string): FlowStep => ({
      type, instruction: instruction ?? '', index: i,
      deepThink: item.deepThink === true || undefined,
    })

    if (typeof item.ai === 'string')            return { ...base('ai', item.ai) }
    if (typeof item.aiAct === 'string')          return { ...base('ai', item.aiAct) }  // 向后兼容 aiAct → ai
    if (typeof item.aiTap === 'string' || (item.aiTap && typeof item.aiTap === 'object')) {
      return { type: 'aiTap', instruction: readPrompt(item.aiTap), index: i }
    }
    if (typeof item.aiInput === 'string' || (item.aiInput && typeof item.aiInput === 'object')) {
      const inputValue = typeof item.value !== 'undefined' ? item.value : readInputValue(item.aiInput)
      return { type: 'aiInput', instruction: readPrompt(item.aiInput), value: inputValue, index: i }
    }
    if (typeof item.sleep === 'number')          return { type: 'sleep', duration: item.sleep, index: i }
    if (typeof item.aiAssert === 'string')       return { type: 'aiAssert', instruction: item.aiAssert, errorMessage: item.errorMessage, name: item.name, index: i }
    if (typeof item.aiScroll === 'string')       return { type: 'aiScroll', instruction: item.aiScroll, index: i }
    for (const type of ['aiHover', 'aiKeyboardPress', 'aiWaitFor', 'aiQuery', 'javascript', 'recordToReport'] as const) {
      if (typeof item[type] === 'string' || typeof item[type] === 'number') return { type, instruction: String(item[type]), index: i }
    }

    const [type, value] = Object.entries(item)[0] || []
    return { type: (type || 'ai') as FlowStep['type'], instruction: value == null ? '' : String(value), index: i }
  }

  // 双向同步仅在 tab 切换 & 提交时触发，不做实时 watch

  // ====== YAML 实时校验 ======
  const validateYamlSchema = (content: string): void => {
    yamlWarnings.value = []

    if (!content?.trim()) {
      yamlError.value = ''
      validationStatus.value = 'idle'
      return
    }

    // 1) 语法校验
    let parsed: any
    try {
      parsed = yaml.load(content)
    } catch (e: any) {
      yamlError.value = `YAML 语法错误：${e.message}`
      // 尝试提取行号
      const lineMatch = e.message.match(/line\s+(\d+)/i) || e.message.match(/at line\s+(\d+)/i)
      if (lineMatch) {
        const line = parseInt(lineMatch[1])
        yamlWarnings.value.push({ line, message: e.message.split('\n')[0] })
      }
      validationStatus.value = 'error'
      return
    }

    if (!parsed || typeof parsed !== 'object') {
      yamlError.value = 'YAML 内容为空或格式不正确'
      validationStatus.value = 'error'
      return
    }

    // 2) 结构校验
    const warnings: Array<{ line: number; message: string }> = []
    let hasError = false

    // 检查 web/android/ios 根节点
    const webConfig = parsed.web
    if (!webConfig || typeof webConfig !== 'object') {
      yamlError.value = 'YAML 结构错误：缺少 web 配置节点'
      validationStatus.value = 'error'
      return
    }

    // 检查 tasks
    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      yamlError.value = 'YAML 结构错误：缺少 tasks 数组'
      validationStatus.value = 'error'
      return
    }

    if (parsed.tasks.length === 0) {
      warnings.push({ line: findLine(content, 'tasks:'), message: 'tasks 数组为空，至少需要一个任务' })
    }

    // 逐 task 校验
    parsed.tasks.forEach((task: any, ti: number) => {
      if (!task.name && task !== null && typeof task === 'object') {
        warnings.push({ line: findLine(content, `- name:`, ti), message: `Task #${ti + 1} 缺少 name 字段` })
      }
      if (!task.flow || !Array.isArray(task.flow)) {
        warnings.push({ line: findLine(content, `flow:`, ti), message: `Task "${task.name || '#' + (ti + 1)}" 缺少 flow 数组` })
      } else if (task.flow.length === 0) {
        warnings.push({ line: findLine(content, `flow:`, ti), message: `Task "${task.name || '#' + (ti + 1)}" 的 flow 为空` })
      } else {
        // 校验 flow 步骤
        task.flow.forEach((step: any, si: number) => {
          const stepInfo = `Task "${task.name || '#' + (ti + 1)}" Step #${si + 1}`
          const stepTypes = Object.keys(FLOW_TYPE_META)
          const stepType = stepTypes.find(t => step[t] !== undefined)

          if (!stepType) {
            if (typeof step === 'string') {
              warnings.push({ line: findLine(content, `- `, ti, si), message: `${stepInfo} 使用了不支持的内联格式` })
            } else if (step && typeof step === 'object') {
              warnings.push({ line: findLine(content, `- `, ti, si), message: `${stepInfo} 类型无法识别` })
            }
          }
        })
      }

      // 校验 continueOnError 类型
      if (task.continueOnError !== undefined && typeof task.continueOnError !== 'boolean') {
        warnings.push({ line: findLine(content, 'continueOnError', ti), message: `Task "${task.name || '#' + (ti + 1)}" 的 continueOnError 应为布尔值` })
      }
    })

    yamlWarnings.value = warnings

    if (hasError) {
      yamlError.value = 'YAML 结构校验失败，请检查错误提示'
      validationStatus.value = 'error'
    } else if (warnings.length > 0) {
      yamlError.value = ''
      validationStatus.value = 'warning'
    } else {
      yamlError.value = ''
      validationStatus.value = 'valid'
    }
  }

  // 辅助：在 YAML 文本中查找指定内容的行号
  const findLine = (content: string, pattern: string, ti?: number, si?: number): number => {
    const lines = content.split('\n')
    let taskCount = -1
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // 匹配 task 开始
      if (line.match(/^\s+-\s+name:/)) taskCount++
      // 匹配指定 task
      if (ti === undefined || taskCount === ti) {
        if (si !== undefined) {
          // 在 flow 中找 step
          let stepCount = -1
          for (let j = i; j < lines.length; j++) {
            if (lines[j].match(/^\s{6}-\s+\w/)) stepCount++
            if (stepCount === si && lines[j].includes(pattern.replace(/^\s*/, ''))) return j + 1
            if (j > i && lines[j].match(/^\s+-\s+name:/)) break // 到下一个 task
          }
        } else if (line.includes(pattern)) {
          return i + 1
        }
        if (ti !== undefined && taskCount > ti) break
      }
    }
    return 1
  }

  // 监听 YAML 内容变化，实时校验
  const dValidate = useDebounce((val: string) => { validateYamlSchema(val) }, 400)
  watch(yamlContent, (val) => {
    if (val === undefined) return
    dValidate(val)
  })

  // Task 管理
  const addTask = (name = '') => {
    if (!formData.value.tasks) formData.value.tasks = []
    formData.value.tasks.push({ name: name || `任务 ${formData.value.tasks.length + 1}`, flow: [], collapsed: false, continueOnError: false })
  }
  const removeTask = (i: number) => { formData.value.tasks?.splice(i, 1) }
  const toggleTaskCollapse = (i: number) => {
    if (formData.value.tasks?.[i]) formData.value.tasks[i].collapsed = !formData.value.tasks[i].collapsed
  }

  // Flow 管理
  const addFlowStepToTask = (ti: number, type: FlowStep['type']) => {
    const tasks = formData.value.tasks; if (!tasks?.[ti]) return
    const step: FlowStep = { type, index: tasks[ti].flow.length }
    tasks[ti].flow.push(step)
  }
  const removeFlowStepFromTask = (ti: number, si: number) => {
    const tasks = formData.value.tasks; if (!tasks?.[ti]) return
    tasks[ti].flow.splice(si, 1); tasks[ti].flow.forEach((s, i) => s.index = i)
  }
  const updateFlowStepInTask = (ti: number, si: number, step: FlowStep) => {
    const tasks = formData.value.tasks; if (!tasks?.[ti]?.flow[si]) return
    tasks[ti].flow[si] = { ...step, index: si }
  }

  // 工具
  const loadExample = () => {
    formData.value = {
      type: 'web', url: '', timeout: 600000,
      tasks: [{
        name: '搜索流程', continueOnError: false,
        flow: [
          { type: 'ai', instruction: '打开 https://www.bing.com', index: 0 },
          { type: 'aiInput', instruction: '搜索框', value: '今日天气', index: 1 },
          { type: 'aiTap', instruction: '搜索按钮', index: 2 },
          { type: 'sleep', duration: 3000, index: 3 },
          { type: 'aiAssert', instruction: '搜索结果包含天气信息', name: 'weather_check', index: 4 },
        ]
      }]
    }; syncFormToYaml()
  }

  const clearAll = () => { formData.value = { type: 'web', url: '', timeout: 600000, tasks: [] }; yamlContent.value = '' }
  const reset = () => { formData.value = { type: 'web', url: '', timeout: 600000, tasks: [] }; yamlContent.value = '# 编辑你的测试 YAML' }
  const loadFromYaml = (s: string) => { isUpdating.value = true; yamlContent.value = s; syncYamlToForm(); isUpdating.value = false }
  const copyYaml = async () => { try { await navigator.clipboard.writeText(yamlContent.value); return true } catch { return false } }
  const downloadYaml = () => {
    const b = new Blob([yamlContent.value], { type: 'text/yaml' })
    const u = URL.createObjectURL(b); const a = document.createElement('a')
    a.href = u; a.download = `${formData.value.tasks?.[0]?.name || 'test'}.yaml`; a.click(); URL.revokeObjectURL(u)
  }

  const setUrl = (url: string) => { formData.value.url = url }

  return {
    yamlContent, formData, activeTab, yamlError, yamlWarnings, validationStatus,
    addTask, removeTask, toggleTaskCollapse,
    addFlowStepToTask, removeFlowStepFromTask, updateFlowStepInTask,
    loadExample, clearAll, reset, loadFromYaml, copyYaml, downloadYaml,
    syncFormToYaml, syncYamlToForm,
    setUrl
  }
}
