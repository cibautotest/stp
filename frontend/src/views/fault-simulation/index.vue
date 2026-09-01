<template>
  <div class="fault-simulation-view">
    <div class="page-toolbar">
      <div>
        <div class="page-title">故障模拟</div>
        <div class="page-subtitle">触发可控后端异常，用于 UI 自动化链路、报文和日志的根因分析验证</div>
      </div>
      <el-tag type="warning" effect="plain">测试环境功能</el-tag>
    </div>

    <section class="simulation-panel">
      <div class="context-row">
        <el-input v-model="note" clearable placeholder="备注，例如：登录失败根因分析回归" />
      </div>

      <div class="scenario-grid">
        <article v-for="scenario in scenarios" :key="scenario.key" class="scenario-card">
          <div class="scenario-main">
            <el-icon class="scenario-icon"><component :is="scenario.icon" /></el-icon>
            <div>
              <h2>{{ scenario.title }}</h2>
              <p>{{ scenario.description }}</p>
            </div>
          </div>
          <div class="scenario-meta">
            <span>HTTP POST</span>
            <code>/api/platform/fault-simulation/{{ scenario.key }}</code>
          </div>
          <el-button
            type="danger"
            :icon="WarningFilled"
            :loading="loadingScenario === scenario.key"
            @click="triggerScenario(scenario.key)"
          >
            触发故障
          </el-button>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Connection, DataLine, WarningFilled } from '@element-plus/icons-vue'
import { triggerFaultSimulation } from '@/api/fault-simulation'
import { useProjectStore } from '@/stores/project'

interface Scenario {
  key: string
  title: string
  description: string
  icon: typeof WarningFilled
}

const projectStore = useProjectStore()
const note = ref('')
const loadingScenario = ref('')

const scenarios: Scenario[] = [
  {
    key: 'sql-primary-key-conflict',
    title: 'SQL 主键冲突',
    description: '后端创建临时表并重复写入同一主键，产生数据库唯一约束异常和 SQL 堆栈。',
    icon: DataLine,
  },
  {
    key: 'null-pointer',
    title: '代码空指针',
    description: '后端访问空对象字段，记录业务上下文后抛出 NullPointerException。',
    icon: WarningFilled,
  },
  {
    key: 'message-parse-failure',
    title: '报文解析失败',
    description: '后端解析一段截断 JSON 报文，记录原始报文片段并抛出解析异常。',
    icon: Connection,
  },
]

const triggerScenario = async (scenario: string) => {
  loadingScenario.value = scenario
  try {
    await triggerFaultSimulation(scenario, {
      projectId: projectStore.currentProject?.id,
      note: note.value.trim(),
    })
  } catch {
    // Keep the page quiet; axios already shows the front-end error toast.
  } finally {
    loadingScenario.value = ''
  }
}
</script>

<style scoped lang="scss">
.fault-simulation-view { display: flex; flex-direction: column; gap: 16px; }
.page-toolbar,
.simulation-panel {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(20, 32, 54, .08);
}
.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
}
.page-title { font-size: 18px; font-weight: 700; color: #1f2d3d; }
.page-subtitle { margin-top: 4px; font-size: 12px; color: #7b8494; }
.simulation-panel { padding: 18px; }
.context-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.scenario-card {
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  padding: 16px;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.scenario-main {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
}
.scenario-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #fff3e8;
  color: #c45656;
  font-size: 22px;
}
.scenario-card h2 {
  margin: 0 0 6px;
  color: #263445;
  font-size: 16px;
  line-height: 1.4;
}
.scenario-card p {
  margin: 0;
  color: #667085;
  font-size: 13px;
  line-height: 1.6;
}
.scenario-meta {
  min-height: 50px;
  padding: 10px;
  border-radius: 8px;
  background: #f6f8fb;
  color: #7b8494;
  font-size: 12px;
}
.scenario-meta span { display: block; margin-bottom: 6px; font-weight: 700; color: #526070; }
.scenario-meta code {
  display: block;
  color: #253044;
  white-space: normal;
  overflow-wrap: anywhere;
}

@media (max-width: 1100px) {
  .scenario-grid { grid-template-columns: 1fr; }
}
</style>
