<template>
  <div class="home-view">
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon projects"><el-icon><Folder /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalProjects }}</div><div class="stat-label">总项目数</div></div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon cases"><el-icon><Document /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.totalCases }}</div><div class="stat-label">总用例数</div></div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon success"><el-icon><CircleCheck /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.successCount }}</div><div class="stat-label">执行成功</div></div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-icon failed"><el-icon><CircleClose /></el-icon></div>
          <div class="stat-info"><div class="stat-value">{{ stats.failedCount }}</div><div class="stat-label">执行失败</div></div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <div class="chart-card">
          <h3 class="chart-title">执行结果统计</h3>
          <BarChart :data="executionStats" :height="300" />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title-row">
            <h3 class="chart-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0">近7日趋势</h3>
            <el-select v-model="trendProjectId" placeholder="全量项目" clearable size="small" style="width:160px" @change="currentPage = 1">
              <el-option label="全量项目" value="" />
              <el-option v-for="p in projectStore.projects" :key="p.id" :label="p.name" :value="p.id" />
            </el-select>
          </div>
          <LineChart :data="dailyStats" :height="300" />
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="12">
        <div class="chart-card">
          <h3 class="chart-title">各项目近七日成功率</h3>
          <SuccessRateChart :data="projectRates" :height="300" />
        </div>
      </el-col>
      <el-col :span="12">
        <div class="chart-card">
          <div class="chart-title-row">
            <h3 class="chart-title" style="margin-bottom:0;border-bottom:none;padding-bottom:0;font-size:15px;font-weight:600;color:#303133;">各项目详细数据</h3>
            <el-popover placement="bottom" :width="300" trigger="hover" :show-after="200">
              <template #reference>
                <el-icon class="help-icon" :size="16"><QuestionFilled /></el-icon>
              </template>
              <div style="font-size:13px;line-height:1.8;">
                <p style="margin:0 0 8px;font-weight:600;">成功率颜色说明</p>
                <p style="margin:2px 0;"><el-tag type="success" size="small">绿色</el-tag>&nbsp; ≥ 设置的阈值，达标</p>
                <p style="margin:2px 0;"><el-tag type="danger" size="small">红色</el-tag>&nbsp; &lt; 设置的阈值，需关注</p>
                <p style="margin:2px 0;"><el-tag type="warning" size="small">黄色</el-tag>&nbsp; 未设置阈值</p>
                <p style="margin:8px 0 0;color:#909399;font-size:12px;">前往【用例管理】→【设置告警】配置</p>
              </div>
            </el-popover>
          </div>
          <el-table :data="projectDetails" stripe class="project-table" height="300">
            <el-table-column prop="projectName" label="项目名称" min-width="110" />
            <el-table-column prop="total" label="用例数" width="75" align="center" />
            <el-table-column label="成功" width="55" align="center"><template #default="{ row }"><span class="success-count">{{ row.success }}</span></template></el-table-column>
            <el-table-column label="失败" width="55" align="center"><template #default="{ row }"><span class="failed-count">{{ row.failed }}</span></template></el-table-column>
            <el-table-column label="整体成功率" width="105" align="center">
              <template #default="{ row }"><el-tag :type="getRateTag(row.avgRate)" size="small">{{ row.avgRate.toFixed(1) }}%</el-tag></template>
            </el-table-column>
            <el-table-column label="7日平均成功率" width="125" align="center">
              <template #default="{ row }">
                <el-tag :type="getAlertTag(row.projectName, 'avg', row.weekAvgRate)" size="small">{{ row.weekAvgRate.toFixed(1) }}%</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="7日最低成功率" width="125" align="center">
              <template #default="{ row }">
                <el-tag :type="getAlertTag(row.projectName, 'min', row.weekMinRate)" size="small">{{ row.weekMinRate.toFixed(1) }}%</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="charts-row">
      <el-col :span="24">
        <div class="chart-card">
          <h3 class="chart-title">最近测试用例</h3>
          <el-table :data="recentCases" stripe class="recent-cases-table">
            <el-table-column prop="name" label="用例名称" />
            <el-table-column prop="projectName" label="所属项目" width="150" />
            <el-table-column prop="type" label="类型" width="100" align="center"><template #default="{ row }"><el-tag size="small">{{ getTypeName(row.type) }}</el-tag></template></el-table-column>
            <el-table-column prop="status" label="状态" width="100" align="center"><template #default="{ row }"><el-tag :type="getStatusType(row.status)" size="small">{{ getStatusName(row.status) }}</el-tag></template></el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" align="center"><template #default="{ row }">{{ formatDateTime(row.created_at) }}</template></el-table-column>
            <el-table-column label="操作" width="150" align="center"><template #default="{ row }"><el-button type="primary" link size="small" @click="viewDetail(row)">查看详情</el-button></template></el-table-column>
          </el-table>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Folder, Document, CircleCheck, CircleClose, QuestionFilled } from '@element-plus/icons-vue'
import { BarChart, LineChart, SuccessRateChart } from '@/components/charts'
import { useProjectStore, useCaseStore } from '@/stores'
import { formatDate } from '@/utils'

interface AlertThreshold { weekAvgThreshold: number; weekMinThreshold: number }
const ALERT_STORAGE_KEY = 'case_alert_thresholds'

const loadThreshold = (projectName: string): AlertThreshold | null => {
  try {
    const raw = localStorage.getItem(ALERT_STORAGE_KEY); if (!raw) return null
    const map = JSON.parse(raw) as Record<string, AlertThreshold>
    // 通过项目名称找到对应阈值（localStorage 里 key 是 projectId，通过名称反查）
    const pid = projectStore.projects.find(p => p.name === projectName)?.id
    if (pid && map[pid]) return map[pid]
    return null
  } catch { return null }
}

const router = useRouter()
const projectStore = useProjectStore()
const caseStore = useCaseStore()

const trendProjectId = ref('')
const currentPage = ref(1)

const pcasesByProjectId = (pid: string) => caseStore.cases.filter(c => (c as any).projectId === pid)
const pnameById = (pid: string) => projectStore.projects.find(p => p.id === pid)?.name || pid

const stats = computed(() => {
  const c = caseStore.cases
  return { totalProjects: projectStore.projects.length, totalCases: c.length, successCount: c.filter(x => x.status === 'SUCCESS').length, failedCount: c.filter(x => x.status === 'FAILED').length }
})

const executionStats = computed(() => projectStore.projects.map(p => {
  const pc = pcasesByProjectId(p.id)
  return { name: p.name, success: pc.filter(c => c.status === 'SUCCESS').length, failed: pc.filter(c => c.status === 'FAILED').length }
}))

const dailyStats = computed(() => {
  const cases = trendProjectId.value ? pcasesByProjectId(trendProjectId.value) : caseStore.cases
  const statsArr: Array<{ date: string; success: number; failed: number }> = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i)
    const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const dayCases = cases.filter(c => c.createdAt && new Date(c.createdAt).toDateString() === date.toDateString())
    statsArr.push({ date: dateStr, success: dayCases.filter(c => c.status === 'SUCCESS').length, failed: dayCases.filter(c => c.status === 'FAILED').length })
  }
  return statsArr
})

const projectRates = computed(() => projectStore.projects.map(p => {
  const projectCases = pcasesByProjectId(p.id)
  const dayGroups: Record<string, { s: number; f: number }> = {}
  projectCases.forEach(c => {
    if (!c.createdAt) return
    const day = c.createdAt.substring(0, 10)
    if (!dayGroups[day]) dayGroups[day] = { s: 0, f: 0 }
    if (c.status === 'SUCCESS') dayGroups[day].s++
    else if (c.status === 'FAILED') dayGroups[day].f++
  })
  const rates = Object.values(dayGroups).map(g => (g.s + g.f) > 0 ? (g.s / (g.s + g.f)) * 100 : 0)
  const min = rates.length > 0 ? Math.min(...rates) : 0
  const max = rates.length > 0 ? Math.max(...rates) : 0
  const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
  return { name: p.name, min, avg, max }
}))

const projectDetails = computed(() => projectStore.projects.map(p => {
  const pc = pcasesByProjectId(p.id)
  const total = pc.length
  const success = pc.filter(c => c.status === 'SUCCESS').length
  const failed = pc.filter(c => c.status === 'FAILED').length
  const avgRate = total > 0 ? (success / total) * 100 : 0
  // 找到该项目在 projectRates 中的值
  const rateInfo = projectRates.value.find(r => r.name === p.name)
  return {
    projectName: p.name, total, success, failed, avgRate,
    weekAvgRate: rateInfo?.avg ?? 0,
    weekMinRate: rateInfo?.min ?? 0
  }
}))

const recentCases = computed(() => [...caseStore.cases].sort((a, b) => {
  const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
  const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
  return bt - at
}).slice(0, 5).map(c => ({
  id: c.id, name: (c as any).nlp ? (c as any).nlp.substring(0, 50) : c.id,
  projectName: pnameById((c as any).projectId) || '未知项目', type: 'web', status: c.status || 'pending', created_at: c.createdAt
})))

const fetchData = async () => { try { await caseStore.fetchCases(); await projectStore.fetchProjects() } catch {} }

// 根据阈值决定标签颜色：低于阈值红色，达标绿色，未设置黄色
const getAlertTag = (projectName: string, field: 'avg' | 'min', rate: number) => {
  const t = loadThreshold(projectName)
  const threshold = field === 'avg' ? (t?.weekAvgThreshold ?? 0) : (t?.weekMinThreshold ?? 0)
  const isAvg = field === 'avg'
  if (!t || (isAvg ? !t.weekAvgThreshold : !t.weekMinThreshold)) return 'warning'
  return rate >= threshold ? 'success' : 'danger'
}

const getRateTag = (r: number) => r >= 80 ? 'success' : r >= 60 ? 'warning' : 'danger'
const getTypeName = (t: string) => ({ web: 'Web测试', task: 'Task任务', flow: 'Flow流程' } as any)[t] || t
const getStatusType = (s: string) => ({ SUCCESS: 'success', FAILED: 'danger', RUNNING: 'warning', PENDING: 'info' } as any)[s] || 'info'
const getStatusName = (s: string) => ({ SUCCESS: '成功', FAILED: '失败', RUNNING: '执行中', PENDING: '待执行' } as any)[s] || s
const formatDateTime = (d: string) => d ? formatDate(d, 'YYYY-MM-DD HH:mm') : '-'
const viewDetail = (r: any) => router.push(`/detail/${r.id}`)

// 首页告警检查
const checkHomeAlerts = () => {
  try {
    // 检查今日是否已设置不提醒
    const muteDate = localStorage.getItem('alert_mute_date')
    const today = new Date().toDateString()
    if (muteDate === today) return

    const raw = localStorage.getItem(ALERT_STORAGE_KEY); if (!raw) return
    const map = JSON.parse(raw) as Record<string, AlertThreshold>
    const alerts: string[] = []
    for (const [pid, config] of Object.entries(map)) {
      const pname = projectStore.projects.find(p => p.id === pid)?.name || pid
      const pc = caseStore.cases.filter(c => (c as any).projectId === pid && c.createdAt)
      const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const dayGroups: Record<string, { s: number; f: number }> = {}
      pc.forEach(c => {
        const d = new Date(c.createdAt!); if (d < sevenDaysAgo) return
        const day = c.createdAt!.substring(0, 10)
        if (!dayGroups[day]) dayGroups[day] = { s: 0, f: 0 }
        if (c.status === 'SUCCESS') dayGroups[day].s++
        else if (c.status === 'FAILED') dayGroups[day].f++
      })
      const rates = Object.values(dayGroups).map(g => (g.s + g.f) > 0 ? (g.s / (g.s + g.f)) * 100 : 0)
      const avg = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 100
      const min = rates.length > 0 ? Math.min(...rates) : 100
      if (config.weekAvgThreshold > 0 && avg < config.weekAvgThreshold) {
        alerts.push(`【${pname}】7日平均成功率 ${avg.toFixed(1)}% 低于阈值 ${config.weekAvgThreshold}%`)
      }
      if (config.weekMinThreshold > 0 && min < config.weekMinThreshold) {
        alerts.push(`【${pname}】7日最低成功率 ${min.toFixed(1)}% 低于阈值 ${config.weekMinThreshold}%`)
      }
    }
    if (alerts.length) {
      ElMessageBox({
        title: '成功率告警',
        message:
          `<div>${alerts.map(a => `<p style="margin:8px 0;color:#e6a23c;">⚠️ ${a}</p>`).join('')}</div>
           <p style="margin-top:12px;color:#909399;font-size:12px;">如需修改阈值，请前往【用例管理】→【设置告警】</p>`,
        dangerouslyUseHTMLString: true,
        type: 'warning',
        showCancelButton: true,
        confirmButtonText: '知道了',
        cancelButtonText: '今日不再提醒',
        distinguishCancelAndClose: true,
      }).then(() => {
        // 点击"知道了" — 不做任何事
      }).catch((action) => {
        if (action === 'cancel') {
          localStorage.setItem('alert_mute_date', today)
        }
      })
    }
  } catch {}
}

onMounted(async () => { await fetchData(); checkHomeAlerts() })
</script>

<style lang="scss" scoped>
.home-view {
  .stats-row { margin-bottom: 20px; }
  .stat-card {
    display: flex; align-items: center; gap: 16px; padding: 24px; background: #fff;
    border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); transition: transform .3s,box-shadow .3s;
    &:hover { transform: translateY(-4px); box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
    .stat-icon { width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 12px; font-size: 28px; color: #fff;
      &.projects { background: linear-gradient(135deg,#667eea,#764ba2); }
      &.cases { background: linear-gradient(135deg,#f093fb,#f5576c); }
      &.success { background: linear-gradient(135deg,#4ade80,#22c55e); }
      &.failed { background: linear-gradient(135deg,#f87171,#ef4444); }
    }
    .stat-info {
      .stat-value { font-size: 28px; font-weight: 700; color: #1a1a2e; line-height: 1.2; }
      .stat-label { font-size: 14px; color: #909399; margin-top: 4px; }
    }
  }
  .charts-row { margin-bottom: 20px; }
    .chart-card {
    background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    .chart-title { font-size: 16px; font-weight: 600; color: #303133; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }
    .chart-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; }
    .project-table, .recent-cases-table { .rate-range { color:#606266; font-size:12px; } }
  }
}
</style>
