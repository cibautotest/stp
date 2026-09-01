<template>
  <div class="execution-terminal" :class="{ collapsed: isCollapsed }">
    <!-- 简化视图（默认缩小） -->
    <div v-if="isCollapsed" class="terminal-collapsed" @click="toggleCollapse">
      <div class="collapsed-content">
        <el-icon class="status-icon" :class="statusClass">
          <Loading v-if="isRunning" />
          <CircleCheck v-else-if="isSuccess" />
          <CircleClose v-else-if="isFailed" />
          <VideoPause v-else />
        </el-icon>
        <span class="status-text">{{ statusText }}</span>
        <el-icon class="expand-icon"><ArrowDown /></el-icon>
      </div>
    </div>

    <!-- 完整视图 -->
    <div v-else class="terminal-full">
      <div class="terminal-header">
        <span class="terminal-title">
          <el-icon><Monitor /></el-icon>
          执行日志
        </span>
        <div class="terminal-actions">
          <el-button size="small" text @click="toggleCollapse">
            <el-icon><ArrowUp /></el-icon>
            收起
          </el-button>
        </div>
      </div>
      <div ref="logContainer" class="terminal-content">
        <div v-if="logs.length === 0" class="terminal-empty">
          等待执行...
        </div>
        <div v-else class="terminal-logs">
          <div
            v-for="(log, index) in logs"
            :key="index"
            class="log-line"
            :class="log.type"
          >
            <span class="log-time">{{ log.time }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Monitor,
  Loading,
  CircleCheck,
  CircleClose,
  VideoPause,
  ArrowUp,
  ArrowDown
} from '@element-plus/icons-vue'

interface LogEntry {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
}

const props = withDefaults(
  defineProps<{
    logs?: LogEntry[]
    status?: 'idle' | 'running' | 'success' | 'failed'
  }>(),
  {
    logs: () => [],
    status: 'idle'
  }
)

const isCollapsed = ref(true)
const logContainer = ref<HTMLElement>()

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}

// 计算状态
const isRunning = computed(() => props.status === 'running')
const isSuccess = computed(() => props.status === 'success')
const isFailed = computed(() => props.status === 'failed')

// 状态文本
const statusText = computed(() => {
  if (isRunning.value) return '执行中...'
  if (isSuccess.value) return '执行成功'
  if (isFailed.value) return '执行失败'
  return '等待执行'
})

// 状态样式
const statusClass = computed(() => ({
  running: isRunning.value,
  success: isSuccess.value,
  failed: isFailed.value
}))

// 滚动到底部
const scrollToBottom = () => {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  }
}

// 暴露方法
defineExpose({
  addLog: (log: Omit<LogEntry, 'time'>) => {
    // 外部控制 logs
  },
  setStatus: (status: 'idle' | 'running' | 'success' | 'failed') => {
    // 外部控制 status
  },
  scrollToBottom
})
</script>

<style lang="scss" scoped>
.execution-terminal {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #1e1e1e;
  overflow: hidden;
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);

  &.collapsed {
    .terminal-collapsed {
      animation: fadeSlideIn 0.3s ease;
    }
  }

  &:not(.collapsed) {
    .terminal-full {
      animation: fadeSlideIn 0.3s ease;
    }
  }

  &.collapsed {
    background: #252526;
  }

  .terminal-collapsed {
    padding: 8px 12px;
    cursor: pointer;
    transition: background 0.3s;

    &:hover {
      background: #2d2d2d;
    }

    .collapsed-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-icon {
      font-size: 16px;

      &.running {
        color: #409eff;
        animation: spin 1s linear infinite;
      }

      &.success {
        color: #67c23a;
      }

      &.failed {
        color: #f56c6c;
      }
    }

    .status-text {
      color: #d4d4d4;
      font-size: 13px;
      flex: 1;
    }

    .expand-icon {
      color: #808080;
    }
  }

  .terminal-full {
    .terminal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      background: #2d2d2d;
      border-bottom: 1px solid #404040;

      .terminal-title {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #d4d4d4;
        font-size: 13px;
        font-weight: 500;
      }

      .terminal-actions {
        :deep(.el-button) {
          color: #808080;

          &:hover {
            color: #d4d4d4;
          }
        }
      }
    }

    .terminal-content {
      height: 200px;
      overflow-y: auto;
      padding: 12px;

      &::-webkit-scrollbar {
        width: 6px;
      }

      &::-webkit-scrollbar-track {
        background: #1e1e1e;
      }

      &::-webkit-scrollbar-thumb {
        background: #404040;
        border-radius: 3px;
      }
    }

    .terminal-empty {
      color: #808080;
      text-align: center;
      padding-top: 60px;
    }

    .terminal-logs {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
    }

    .log-line {
      display: flex;
      gap: 12px;
      padding: 2px 0;
      line-height: 1.5;

      &.info .log-message {
        color: #d4d4d4;
      }

      &.success .log-message {
        color: #67c23a;
      }

      &.error .log-message {
        color: #f56c6c;
      }

      &.warning .log-message {
        color: #e6a23c;
      }

      .log-time {
        color: #808080;
        flex-shrink: 0;
      }

      .log-message {
        word-break: break-all;
      }
    }
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeSlideIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
