<template>
  <div class="plans-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <el-select v-model="filterProjectId" placeholder="全部项目" clearable class="project-filter" @change="handleFilterChange">
          <el-option v-for="project in (projectStore.projects || [])" :key="project.id" :label="project.name" :value="project.id" />
        </el-select>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>新建计划
        </el-button>
        <el-button @click="loadData"><el-icon><Refresh /></el-icon>刷新</el-button>
      </div>
    </div>

    <div class="plans-list">
      <div v-for="(group, projectName) in groupedPlans" :key="projectName" class="project-group">
        <div class="project-group-title">
          <el-icon><Folder /></el-icon>
          <span>{{ projectName }}</span>
          <el-tag size="small" type="info">{{ group.length }} 个计划</el-tag>
        </div>

        <el-collapse v-model="expandedPlans" class="plan-collapse" @change="handleCollapseChange">
          <el-collapse-item v-for="plan in group" :key="plan.id" :name="plan.id" class="plan-item">
            <template #title>
              <div class="plan-header">
                <div class="plan-info">
                  <el-icon class="plan-icon"><List /></el-icon>
                  <span class="plan-name">{{ plan.name }}</span>
                  <el-tag v-if="plan.status === 'ARCHIVED'" size="small" type="warning">已归档</el-tag>
                  <el-tag size="small" type="info">{{ planCaseCounts[plan.id] ?? '-' }} 个用例</el-tag>
                  <el-tag
                    v-if="plan.lastExecutionResult"
                    size="small"
                    :type="getExecutionResultTagType(plan.lastExecutionResult)"
                  >
                    {{ getExecutionResultLabel(plan.lastExecutionResult) }}
                  </el-tag>
                  <span v-if="plan.lastExecutedAt" class="execution-time">
                    {{ formatExecTime(plan.lastExecutedAt) }}
                  </span>
                </div>
                <div class="plan-actions" @click.stop>
                  <el-button
                    text size="small"
                    type="success"
                    :disabled="planStore.isExecuting(plan.id)"
                    :loading="planStore.isExecuting(plan.id)"
                    @click="handleExecutePlan(plan)"
                  >
                    <el-icon><VideoPlay /></el-icon>{{ planStore.isExecuting(plan.id) ? '执行中' : '执行' }}
                  </el-button>
                  <el-button text size="small" type="primary" @click="showEditDialog(plan)">编辑</el-button>
                  <el-button text size="small" type="danger" @click="handleDelete(plan)">删除</el-button>
                </div>
              </div>
            </template>

            <div v-if="expandedPlans.includes(plan.id)" class="plan-cases">
              <el-table :data="planCases[plan.id] || []" stripe size="small" empty-text="该计划暂无用例">
                <el-table-column prop="name" label="用例名称" min-width="180">
                  <template #default="{ row }">
                    <el-link type="primary" @click="router.push(`/detail/${row.id}`)">{{ row.name || row.id }}</el-link>
                  </template>
                </el-table-column>
                <el-table-column prop="status" label="状态" width="100" align="center">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusName(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" align="center">
                  <template #default="{ row }">
                    <el-button type="danger" link size="small" @click="handleRemoveCase(plan, row)">移除</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="add-case-btn">
                <el-button size="small" type="primary" plain @click="showAddCasesDialog(plan)">
                  <el-icon><Plus /></el-icon>添加用例
                </el-button>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <el-empty v-if="!Object.keys(groupedPlans).length && !loading" description="暂无测试计划">
        <el-button type="primary" @click="showCreateDialog">新建计划</el-button>
      </el-empty>
    </div>

    <el-dialog v-model="createDialogVisible" :title="isEditing ? '编辑计划' : '新建计划'" width="520px" :close-on-click-modal="false">
      <el-form label-position="top">
        <el-form-item label="所属项目" :required="!isEditing">
          <el-select v-model="form.projectId" placeholder="请选择项目" :disabled="isEditing" class="full-width">
            <el-option v-for="p in (projectStore.projects || [])" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="计划名称" required>
          <el-input v-model="form.name" placeholder="请输入计划名称" maxlength="128" />
        </el-form-item>
        <el-form-item label="计划描述">
          <el-input v-model="form.description" placeholder="可选描述" type="textarea" :rows="2" maxlength="512" />
        </el-form-item>
        <el-form-item v-if="!isEditing" label="选择用例">
          <el-transfer
            v-model="form.caseIds"
            :data="caseTransferData"
            :titles="['可选用例', '已选用例']"
            filterable
            filter-placeholder="搜索用例"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="confirmSave">确认</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="addCasesDialogVisible" title="添加用例到计划" width="800px" class="add-cases-dialog">
      <div v-if="addCasesTargetPlan" class="dialog-header">
        <span>计划: <strong>{{ addCasesTargetPlan.name }}</strong></span>
        <el-tag size="small" type="info">已有关联 {{ existingPlanCaseIds.length }} 个用例</el-tag>
      </div>
      <div class="cases-selector">
        <!-- 左侧：可选用例 -->
        <div class="selector-panel left-panel">
          <div class="panel-head">
            <span class="panel-title">可选用例</span>
            <el-input v-model="addCasesSearch" size="small" placeholder="搜索用例" clearable class="panel-search" />
          </div>
          <div class="panel-body">
            <div
              v-for="item in filteredAvailableCases"
              :key="item.key"
              class="case-item"
              :class="{ selected: addCasesSelection.includes(item.key) }"
              @click="toggleCaseSelect(item.key)"
            >
              <el-checkbox :model-value="addCasesSelection.includes(item.key)" />
              <span class="case-label">{{ item.label }}</span>
            </div>
            <el-empty v-if="filteredAvailableCases.length === 0" description="无可选用例" :image-size="48" />
          </div>
        </div>
        <!-- 右侧：本次新增 -->
        <div class="selector-panel right-panel">
          <div class="panel-head">
            <span class="panel-title">本次新增</span>
            <span class="panel-count">{{ addCasesSelection.length }} 个</span>
          </div>
          <div class="panel-body">
            <div v-for="key in addCasesSelection" :key="key" class="case-item selected-item">
              <span class="case-label">{{ getCaseName(key) }}</span>
              <el-button type="danger" link size="small" @click="removeSelection(key)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
            <el-empty v-if="addCasesSelection.length === 0" description="请从左侧选择用例" :image-size="48" />
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="addCasesDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="addingCases" :disabled="addCasesSelection.length === 0" @click="confirmAddCases">
          确认添加 ({{ addCasesSelection.length }})
        </el-button>
      </template>
    </el-dialog>

    <BatchProgressDialog v-model="batchDialogVisible" :batch-id="executingBatchId" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Folder, List, VideoPlay, Delete } from '@element-plus/icons-vue'
import { useProjectStore, usePlanStore, useCaseStore } from '@/stores'
import BatchProgressDialog from '@/components/BatchProgressDialog.vue'
import type { TestPlan } from '@/api/plans'

const router = useRouter()
const projectStore = useProjectStore()
const planStore = usePlanStore()
const caseStore = useCaseStore()

const filterProjectId = ref<string | null>(null)
const loading = ref(false)
const expandedPlans = ref<string[]>([])
const planCases = ref<Record<string, any[]>>({})
const planCaseCounts = ref<Record<string, number>>({})

// 执行相关
const batchDialogVisible = ref(false)
const executingBatchId = ref('')

// 安全获取数组 - 防止 store 数据未初始化时崩溃
function safeArray<T>(arr: T[] | undefined | null): T[] {
  return Array.isArray(arr) ? arr : []
}

// 按项目分组的计划
const groupedPlans = computed(() => {
  try {
    const grouped: Record<string, TestPlan[]> = {}
    const allPlans = safeArray(planStore.plans)
    const allProjects = safeArray(projectStore.projects)

    const filtered = filterProjectId.value
      ? allPlans.filter(p => p.projectId === filterProjectId.value)
      : allPlans

    filtered.forEach(p => {
      const projectName = allProjects.find(pr => pr.id === p.projectId)?.name || '未知项目'
      if (!grouped[projectName]) grouped[projectName] = []
      grouped[projectName].push(p)
    })
    return grouped
  } catch {
    return {}
  }
})

// 创建/编辑对话框
const createDialogVisible = ref(false)
const isEditing = ref(false)
const editingPlanId = ref<string | null>(null)
const form = ref({ name: '', projectId: '', description: '', caseIds: [] as string[] })
const saving = ref(false)

// 添加用例对话框
const addCasesDialogVisible = ref(false)
const addCasesTargetPlan = ref<TestPlan | null>(null)
const addCasesSelection = ref<string[]>([])
const addingCases = ref(false)

// 用例数据传输
const caseTransferData = computed(() => {
  try {
    const allCases = safeArray(caseStore.cases as any[])
    const allProjects = safeArray(projectStore.projects)
    return allCases
      .filter((c: any) => {
        if (form.value.projectId) {
          const proj = allProjects.find(p => p.id === form.value.projectId)
          return !proj || (c as any).projectId === proj.id
        }
        return true
      })
      .map((c: any) => ({
        key: c.id,
        label: c.name || c.id,
        disabled: false
      }))
  } catch {
    return []
  }
})

// 计划已有关联用例 ID 集合（用于穿梭框排除）
const existingPlanCaseIds = computed(() => {
  if (!addCasesTargetPlan.value) return []
  const cases = planCases.value[addCasesTargetPlan.value.id] || []
  return cases.map((c: any) => c.caseId || c.id).filter(Boolean)
})

const addCasesTransferData = computed(() => {
  try {
    if (!addCasesTargetPlan.value) return []
    const allCases = safeArray(caseStore.cases as any[])
    const allProjects = safeArray(projectStore.projects)
    const proj = allProjects.find(p => p.id === addCasesTargetPlan.value!.projectId)
    // 只排除计划已有关联用例（不排除 addCasesSelection，否则 transfer 右侧会消失）
    const excludeIds = new Set(existingPlanCaseIds.value)
    return allCases
      .filter((c: any) => (!proj || (c as any).projectId === proj.id) && !excludeIds.has(c.id))
      .map((c: any) => ({
        key: c.id,
        label: c.name || c.id,
        disabled: false
      }))
  } catch {
    return []
  }
})

// 搜索过滤后的可选用例
const addCasesSearch = ref('')
const filteredAvailableCases = computed(() => {
  const search = addCasesSearch.value.trim().toLowerCase()
  if (!search) return addCasesTransferData.value
  return addCasesTransferData.value.filter(item =>
    item.label.toLowerCase().includes(search)
  )
})

// 切换用例选择
const toggleCaseSelect = (key: string) => {
  const idx = addCasesSelection.value.indexOf(key)
  if (idx === -1) {
    addCasesSelection.value.push(key)
  } else {
    addCasesSelection.value.splice(idx, 1)
  }
}

// 从本次新增中移除
const removeSelection = (key: string) => {
  const idx = addCasesSelection.value.indexOf(key)
  if (idx !== -1) addCasesSelection.value.splice(idx, 1)
}

// 获取用例名称
const getCaseName = (key: string) => {
  const item = addCasesTransferData.value.find(c => c.key === key)
  return item?.label || key
}

const handleCollapseChange = (activeNames: string[] | string) => {
  const names = Array.isArray(activeNames) ? activeNames : [activeNames]
  const newlyExpanded = names.filter(n => !planCases.value[n])
  newlyExpanded.forEach(async (planId) => {
    try {
      const cases = await planStore.fetchPlanCases(planId)
      planCases.value[planId] = cases || []
    } catch {
      planCases.value[planId] = []
    }
  })
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    await Promise.all([
      projectStore.fetchProjects().catch(() => {}),
      planStore.fetchPlans().catch(() => {}),
      caseStore.fetchCases().catch(() => {})
    ])
    const allPlans = safeArray(planStore.plans)
    for (const plan of allPlans) {
      try {
        const cases = await planStore.fetchPlanCases(plan.id)
        planCases.value[plan.id] = cases || []
        planCaseCounts.value[plan.id] = (cases || []).length
      } catch {
        planCaseCounts.value[plan.id] = 0
        planCases.value[plan.id] = []
      }
    }
  } catch {
    // 忽略
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})

function handleFilterChange() {
  loadData()
}

function showCreateDialog() {
  isEditing.value = false
  editingPlanId.value = null
  form.value = { name: '', projectId: '', description: '', caseIds: [] }
  createDialogVisible.value = true
}

function showEditDialog(plan: TestPlan) {
  isEditing.value = true
  editingPlanId.value = plan.id
  form.value = {
    name: plan.name,
    projectId: plan.projectId,
    description: plan.description || '',
    caseIds: []
  }
  createDialogVisible.value = true
}

async function confirmSave() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入计划名称')
    return
  }
  if (!isEditing.value && !form.value.projectId) {
    ElMessage.warning('请选择所属项目')
    return
  }
  saving.value = true
  try {
    if (isEditing.value && editingPlanId.value) {
      await planStore.editPlan(editingPlanId.value, {
        name: form.value.name.trim(),
        description: form.value.description.trim()
      })
      ElMessage.success('计划已更新')
    } else {
      await planStore.addPlan({
        name: form.value.name.trim(),
        projectId: form.value.projectId,
        description: form.value.description.trim(),
        caseIds: form.value.caseIds
      })
      ElMessage.success('计划创建成功')
    }
    createDialogVisible.value = false
    await loadData()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '操作失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(plan: TestPlan) {
  try {
    await ElMessageBox.confirm(`确定删除计划"${plan.name}"吗？`, '删除确认', { type: 'warning' })
    await planStore.removePlan(plan.id)
    delete planCases.value[plan.id]
    delete planCaseCounts.value[plan.id]
    ElMessage.success('计划已删除')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

function showAddCasesDialog(plan: TestPlan) {
  addCasesTargetPlan.value = plan
  addCasesSelection.value = []
  addCasesDialogVisible.value = true
}

async function confirmAddCases() {
  if (!addCasesTargetPlan.value || !addCasesSelection.value.length) {
    ElMessage.warning('请选择要添加的用例')
    return
  }
  addingCases.value = true
  try {
    await planStore.addCases(addCasesTargetPlan.value.id, addCasesSelection.value)
    ElMessage.success(`已添加 ${addCasesSelection.value.length} 个用例`)
    addCasesDialogVisible.value = false
    planCases.value[addCasesTargetPlan.value.id] = await planStore.fetchPlanCases(addCasesTargetPlan.value.id)
    planCaseCounts.value[addCasesTargetPlan.value.id] = (planCases.value[addCasesTargetPlan.value.id] || []).length
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '添加失败')
  } finally {
    addingCases.value = false
  }
}

async function handleRemoveCase(plan: TestPlan, caseItem: any) {
  try {
    await ElMessageBox.confirm(`从计划中移除用例"${caseItem.name || caseItem.id}"吗？`, '移除确认', { type: 'warning' })
    await planStore.removeCase(plan.id, caseItem.id)
    planCases.value[plan.id] = (planCases.value[plan.id] || []).filter((c: any) => c.id !== caseItem.id)
    planCaseCounts.value[plan.id] = Math.max(0, (planCaseCounts.value[plan.id] || 0) - 1)
    ElMessage.success('已移除')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('移除失败')
  }
}

const getStatusType = (s: string) => ({
  SUCCESS: 'success', FAILED: 'danger', RUNNING: 'warning', PENDING: 'info', UNKNOWN: 'warning'
} as any)[s] || 'info'
const getStatusName = (s: string) => ({
  SUCCESS: '成功', FAILED: '失败', RUNNING: '执行中', PENDING: '未执行', UNKNOWN: '未知'
} as any)[s] || s

// 执行计划
async function handleExecutePlan(plan: TestPlan) {
  const caseCount = planCaseCounts.value[plan.id] || 0
  if (caseCount === 0) {
    ElMessage.warning('"${plan.name}" 中没有用例，无法执行')
    return
  }

  try {
    const result = await planStore.runPlan(plan.id)
    if (result) {
      executingBatchId.value = result.batchId
      batchDialogVisible.value = true
      ElMessage.success(`已提交 ${result.totalCases} 个用例执行`)
    } else {
      ElMessage.error('提交执行失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '执行失败')
  }
}

// BatchProgressDialog 关闭时刷新数据
watch(batchDialogVisible, async (visible) => {
  if (!visible && executingBatchId.value) {
    const planId = Object.keys(planStore.executingBatches).find(
      pid => planStore.executingBatches[pid] === executingBatchId.value
    )
    if (planId) planStore.markExecutionComplete(planId)
    executingBatchId.value = ''
    await loadData()
  }
})

// 执行结果标签类型
function getExecutionResultTagType(result: string): string {
  if (result === 'PASSED') return 'success'
  if (result === 'FAILED' || result.endsWith('_FAILED')) return 'danger'
  if (result === 'NO_CASES') return 'info'
  return 'warning'
}

// 执行结果标签文本
function getExecutionResultLabel(result: string): string {
  if (result === 'PASSED') return '全部通过'
  if (result === 'FAILED') return '全部失败'
  if (result.endsWith('_FAILED')) {
    const n = result.replace('_FAILED', '')
    return `${n} 个失败`
  }
  if (result === 'NO_CASES') return '无用例'
  return result
}

// 格式化执行时间
function formatExecTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ''
  }
}
</script>

<style lang="scss" scoped>
.plans-view {
  .toolbar {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
    background: #fff; padding: 16px 20px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 12px; }
    .project-filter { width: 200px; }
  }
  .plans-list {
    .project-group {
      margin-bottom: 20px;
      .project-group-title {
        display: flex; align-items: center; gap: 8px;
        padding: 12px 16px; background: #ecf5ff;
        border-radius: 8px 8px 0 0; font-weight: 600; color: #303133;
        .el-icon { color: #409eff; font-size: 18px; }
      }
      .plan-collapse {
        border-radius: 0 0 8px 8px;
        :deep(.el-collapse-item__header) {
          background: #fff; padding: 8px 16px; border-bottom: 1px solid #ebeef5;
        }
        :deep(.el-collapse-item__wrap) { border: none; }
        :deep(.el-collapse-item__content) { padding: 12px 16px; background: #fafafa; }
        .plan-item:last-child :deep(.el-collapse-item__header) { border-bottom: none; }
      }
      .plan-header {
        display: flex; align-items: center; justify-content: space-between; width: 100%; padding-right: 12px;
        .plan-info { display: flex; align-items: center; gap: 8px;
          .plan-icon { color: #67c23a; font-size: 16px; }
          .plan-name { font-weight: 500; color: #303133; }
          .execution-time { font-size: 11px; color: #909399; margin-left: 4px; }
        }
        .plan-actions { display: flex; gap: 4px; }
      }
      .plan-cases {
        .add-case-btn { margin-top: 12px; }
      }
    }
  }
  .full-width { width: 100%; }
  .dialog-subtitle { margin: 0 0 12px; color: #606266; }
}
.add-cases-dialog {
  .dialog-header {
    display: flex; align-items: center; gap: 12px; margin-bottom: 16px;
    font-size: 14px; color: #606266;
  }
  .cases-selector {
    display: flex; gap: 16px; min-height: 360px;
    .selector-panel {
      flex: 1; border: 1px solid #e4e7ed; border-radius: 8px;
      overflow: hidden; display: flex; flex-direction: column;
      &.left-panel { background: #fafbfc; }
      &.right-panel { background: #f0f9eb; border-color: #b7eb8f; }
      .panel-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px; border-bottom: 1px solid #e4e7ed;
        background: #fff;
        .panel-title { font-size: 13px; font-weight: 600; color: #303133; }
        .panel-count { font-size: 12px; color: #67c23a; font-weight: 600; }
        .panel-search { width: 160px; }
      }
      .panel-body {
        flex: 1; overflow-y: auto; padding: 6px;
        .case-item {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          border-radius: 6px; cursor: pointer; transition: background .15s;
          font-size: 13px; color: #303133;
          &:hover { background: rgba(64,158,255,.08); }
          &.selected { background: #ecf5ff; }
          .case-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          &.selected-item {
            cursor: default; background: #f0f9eb;
            .case-label { color: #303133; }
          }
        }
      }
    }
  }
}
</style>
