<template>
  <el-dialog
    v-model="visible"
    title="批量执行进度"
    width="520px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    @close="handleClose"
  >
    <div class="batch-progress-content">
      <div class="progress-header">
        <span class="project-name">{{ progress?.projectName || '' }}</span>
        <el-tag :type="progress?.status === 'COMPLETED' ? 'success' : 'warning'" size="small">
          {{ progress?.status === 'COMPLETED' ? '执行完成' : '执行中' }}
        </el-tag>
      </div>

      <el-progress
        :percentage="progressPercentage"
        :status="progress?.status === 'COMPLETED' ? (progress!.failed > 0 ? 'warning' : 'success') : undefined"
        :stroke-width="20"
        :text-inside="true"
        class="progress-bar"
      >
        <template #default="{ percentage }">
          <span class="progress-text">{{ progress?.completed || 0 }}/{{ progress?.total || 0 }} 已完成</span>
        </template>
      </el-progress>

      <div class="stats-row">
        <span class="stat-item success">
          <el-icon><CircleCheck /></el-icon> 成功 {{ progress?.success || 0 }}
        </span>
        <span class="stat-item failed">
          <el-icon><CircleClose /></el-icon> 失败 {{ progress?.failed || 0 }}
        </span>
        <span class="stat-item running">
          <el-icon><Loading /></el-icon> 执行中 {{ progress?.running || 0 }}
        </span>
      </div>

      <div class="case-list">
        <div
          v-for="c in progress?.cases || []"
          :key="c.caseId"
          class="case-item"
          :class="c.status.toLowerCase()"
        >
          <el-icon v-if="c.status === 'SUCCESS'" class="case-icon success"><CircleCheck /></el-icon>
          <el-icon v-else-if="c.status === 'FAILED'" class="case-icon failed"><CircleClose /></el-icon>
          <el-icon v-else class="case-icon running"><Loading /></el-icon>
          <span class="case-name" :title="c.caseName || c.caseId">{{ c.caseName || c.caseId }}</span>
          <el-tag
            :type="c.status === 'SUCCESS' ? 'success' : c.status === 'FAILED' ? 'danger' : 'warning'"
            size="small"
            class="case-tag"
          >
            {{ c.status === 'SUCCESS' ? '成功' : c.status === 'FAILED' ? '失败' : '执行中' }}
          </el-tag>
        </div>
      </div>

      <div v-if="progress?.status === 'COMPLETED' && progress?.mergedReportUrl" class="report-action">
        <el-button type="primary" @click="openReport">
          <el-icon><Document /></el-icon>查看合并报告
        </el-button>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">
        {{ progress?.status === 'COMPLETED' ? '关闭' : '后台执行' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import { CircleCheck, CircleClose, Loading, Document } from '@element-plus/icons-vue'
import { getBatchProgress } from '@/api/cases'
import type { BatchProgress } from '@/types'

const props = defineProps<{
  modelValue: boolean
  batchId: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const progress = ref<BatchProgress | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const progressPercentage = computed(() => {
  if (!progress.value || progress.value.total === 0) return 0
  return Math.round((progress.value.completed / progress.value.total) * 100)
})

const fetchProgress = async () => {
  try {
    const res = await getBatchProgress(props.batchId)
    progress.value = res
    if (res.status === 'COMPLETED') {
      stopPolling()
    }
  } catch {
    // ignore
  }
}

const startPolling = () => {
  fetchProgress()
  pollTimer = setInterval(fetchProgress, 3000)
}

const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

const openReport = () => {
  if (progress.value?.mergedReportUrl) {
    window.open(progress.value.mergedReportUrl, '_blank')
  }
}

const handleClose = () => {
  stopPolling()
  visible.value = false
}

watch(() => props.modelValue, (val) => {
  if (val && props.batchId) {
    progress.value = null
    startPolling()
  } else {
    stopPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style lang="scss" scoped>
.batch-progress-content {
  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    .project-name {
      font-size: 15px;
      font-weight: 600;
      color: #303133;
    }
  }
  .progress-bar {
    margin-bottom: 12px;
    .progress-text {
      font-size: 12px;
      color: #fff;
    }
  }
  .stats-row {
    display: flex;
    gap: 20px;
    margin-bottom: 16px;
    .stat-item {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      &.success { color: #67c23a; }
      &.failed { color: #f56c6c; }
      &.running { color: #e6a23c; }
    }
  }
  .case-list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid #ebeef5;
    border-radius: 6px;
    .case-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid #f0f0f0;
      &:last-child { border-bottom: none; }
      &.running { background: #fdf6ec; }
      &.failed { background: #fef0f0; }
      &.success { background: #f0f9eb; }
      .case-icon { font-size: 16px; flex-shrink: 0; }
      .case-icon.success { color: #67c23a; }
      .case-icon.failed { color: #f56c6c; }
      .case-icon.running { color: #e6a23c; animation: spin 1s linear infinite; }
      .case-name {
        flex: 1;
        font-size: 13px;
        color: #606266;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .case-tag { flex-shrink: 0; }
    }
  }
  .report-action {
    margin-top: 16px;
    text-align: center;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
