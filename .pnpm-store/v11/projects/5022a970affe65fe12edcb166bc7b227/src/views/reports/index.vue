<template>
  <div class="reports-view">
    <div class="page-toolbar">
      <div>
        <div class="page-title">报告中心</div>
        <div class="page-subtitle">查看 Midscene 原生报告与接口请求记录</div>
      </div>
      <el-button :icon="Refresh" @click="handleRefresh">刷新</el-button>
    </div>

    <section class="report-panel">
      <div class="filter-row">
        <el-select v-model="directoryId" clearable placeholder="全部目录" class="directory-filter" @change="handleRefresh">
          <el-option v-for="directory in directories" :key="directory.id" :label="directory.name" :value="directory.id" />
        </el-select>
      </div>

      <el-table v-loading="reportStore.loading" :data="reportStore.reports" stripe class="reports-table">
        <el-table-column prop="id" label="报告ID" width="88" align="center" />
        <el-table-column prop="name" label="报告名称" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="report-name">
              <span class="report-name-main">{{ row.name || '-' }}</span>
              <span v-if="row.caseId" class="report-name-meta">Case {{ row.caseId }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="row.type === 'BATCH' ? 'warning' : 'info'" size="small">
              {{ row.type === 'BATCH' ? '批量' : '单次' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="96" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusName(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="耗时" width="110" align="center">
          <template #default="{ row }">{{ formatDuration(row.duration) }}</template>
        </el-table-column>
        <el-table-column prop="projectName" label="项目" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.projectName || row.projectId || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="176" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="300" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openReportDetail(row, 'native')">查看报告</el-button>
            <el-button type="info" link size="small" :disabled="!row.id" @click="openReportDetail(row, 'api')">接口记录</el-button>
            <el-button type="warning" link size="small" :disabled="!row.id" @click="openReportDetail(row, 'rootCause')">根因分析</el-button>
            <el-button type="danger" link size="small" @click="deleteReport(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="reportStore.total > 0" class="pagination-wrap">
        <el-pagination
          v-model:current-page="reportStore.page"
          v-model:page-size="reportStore.size"
          :page-sizes="[10, 20, 50]"
          :total="reportStore.total"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>

      <el-empty v-if="!reportStore.loading && reportStore.reports.length === 0" description="暂无测试报告" />
    </section>

    <el-drawer v-model="detailVisible" :title="selectedReport?.name || '报告详情'" size="92%" class="report-detail-drawer">
      <el-tabs v-model="activeTab" class="report-tabs">
        <el-tab-pane label="原生报告" name="native">
          <div v-if="nativeReportLoading" class="native-report-state">
            <el-skeleton :rows="8" animated />
          </div>
          <div v-else-if="nativeReportUrl" class="native-report-frame">
            <iframe :src="nativeReportUrl" title="Midscene 原生报告" sandbox="allow-scripts allow-same-origin" />
          </div>
          <div v-else-if="selectedReport?.result" class="native-report-state">
            <el-result icon="warning" title="原生报告文件不可用" :sub-title="nativeReportError || '报告记录存在，但平台归档的 HTML 文件不存在或暂时无法访问。'">
              <template #extra>
                <el-button type="primary" @click="checkNativeReport">重新检查</el-button>
                <el-button @click="openNativeReportWindow">新窗口打开</el-button>
              </template>
            </el-result>
          </div>
          <el-empty v-else description="该报告暂无原生报告文件" />
        </el-tab-pane>

        <el-tab-pane label="接口记录" name="api">
          <div class="api-workspace">
            <aside class="api-list">
              <div class="api-list-header">
                <div>
                  <div class="section-title">接口请求</div>
                  <div class="section-meta">{{ filteredExchanges.length }} / {{ exchanges.length }} 条记录</div>
                </div>
                <el-button size="small" :loading="exchangeLoading" @click="reloadExchanges">刷新</el-button>
              </div>
              <div class="api-search">
                <el-input
                  v-model="apiSearchKeyword"
                  clearable
                  placeholder="搜索 URL、请求体或响应体"
                  @clear="selectFirstFilteredExchange"
                  @input="selectFirstFilteredExchange"
                />
              </div>

              <el-skeleton v-if="exchangeLoading" :rows="8" animated />
              <el-empty v-else-if="exchanges.length === 0" description="暂无接口记录" />
              <el-empty v-else-if="filteredExchanges.length === 0" description="未匹配到接口记录" />
              <div v-else class="api-items">
                <button
                  v-for="item in filteredExchanges"
                  :key="item.requestId"
                  class="api-item"
                  :class="{ active: selectedExchange?.requestId === item.requestId }"
                  @click="selectedExchange = item"
                >
                  <span class="method" :class="methodClass(item.method)">{{ item.method || '-' }}</span>
                  <span class="api-url">{{ shortUrl(item.url) }}</span>
                  <span class="api-meta">
                    <el-tag :type="statusTagType(item.statusCode)" size="small">{{ item.statusCode || 'ERR' }}</el-tag>
                    <span>{{ formatMs(item.durationMs) }}</span>
                    <span>{{ formatTime(item.startedAt) }}</span>
                  </span>
                </button>
              </div>
            </aside>

            <main class="api-detail">
              <el-empty v-if="!selectedExchange" description="请选择一条接口请求" />
              <template v-else>
                <div class="detail-heading">
                  <div>
                    <div class="detail-url">{{ selectedExchange.url }}</div>
                    <div class="detail-meta">
                      <el-tag :type="methodTagType(selectedExchange.method)" size="small">{{ selectedExchange.method }}</el-tag>
                      <el-tag :type="statusTagType(selectedExchange.statusCode)" size="small">{{ selectedExchange.statusCode || '请求失败' }}</el-tag>
                      <span>{{ formatMs(selectedExchange.durationMs) }}</span>
                      <span>{{ formatDateTime(selectedExchange.startedAt) }}</span>
                    </div>
                  </div>
                  <div class="detail-actions">
                    <el-button
                      type="primary"
                      :disabled="!selectedExchange.id || !selectedExchange.traceId"
                      :loading="traceLoading"
                      @click="loadTraceTopology"
                    >
                      查看接口链路
                    </el-button>
                    <el-button
                      type="info"
                      :disabled="!selectedExchange.id || !selectedExchange.traceId"
                      :loading="traceLogLoading"
                      @click="loadTraceLogs"
                    >
                      查看接口日志
                    </el-button>
                  </div>
                </div>

                <div class="metric-grid">
                  <div class="metric"><span>响应时间</span><strong>{{ formatMs(selectedExchange.durationMs) }}</strong></div>
                  <div class="metric"><span>应答码</span><strong>{{ selectedExchange.statusCode || '-' }}</strong></div>
                  <div class="metric"><span>Content-Type</span><strong>{{ selectedExchange.contentType || '-' }}</strong></div>
                  <div class="metric trace-id-metric">
                    <span>Trace ID</span>
                    <div class="trace-id-row">
                      <strong class="trace-id-value" :title="selectedExchange.traceId || ''">{{ selectedExchange.traceId || '-' }}</strong>
                      <el-button
                        v-if="selectedExchange.traceId"
                        type="primary"
                        link
                        size="small"
                        class="trace-id-copy"
                        @click="copyTraceId(selectedExchange.traceId)"
                      >
                        Copy
                      </el-button>
                    </div>
                  </div>
                </div>

                <el-alert v-if="selectedExchange.errorMessage" :title="selectedExchange.errorMessage" type="error" show-icon :closable="false" />

                <el-drawer v-model="traceVisible" title="Trace Topology" size="100%" direction="rtl" class="trace-fullscreen-drawer">
                  <div class="trace-drawer-content">
                  <div class="trace-card-header">
                    <div>
                      <div class="payload-title">Trace Topology</div>
                      <div class="section-meta">
                        {{ traceTopology?.nodes?.length || 0 }} nodes / {{ traceTopology?.edges?.length || 0 }} edges
                      </div>
                    </div>
                    <div class="trace-actions">
                      <el-button size="small" @click="collapseAllServices">收起依赖</el-button>
                      <el-button size="small" @click="expandAllServices">展开依赖</el-button>
                      <el-button size="small" @click="traceVisible = false">Hide</el-button>
                    </div>
                  </div>
                  <el-alert
                    v-if="traceTopology?.errorMessage"
                    :title="traceTopology.errorMessage"
                    type="warning"
                    show-icon
                    :closable="false"
                  />
                  <div v-else class="trace-workspace">
                    <aside class="trace-span-panel">
                  <el-table v-if="traceTopologyNodes.length" :data="traceTopologyNodes" size="small" height="100%" class="trace-span-table">
                    <el-table-column label="节点" min-width="180" show-overflow-tooltip>
                      <template #default="{ row }">
                        <span class="service-cell">
                          <span class="service-dot" :style="{ backgroundColor: row.error ? '#d93025' : serviceColor(row.service || row.name) }"></span>
                          {{ traceNodeBaseName(row) || '-' }}
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column label="Service" min-width="150" show-overflow-tooltip>
                      <template #default="{ row }">
                        <span class="service-cell">
                          <span class="service-dot" :style="{ backgroundColor: serviceColor(row.service) }"></span>
                          {{ row.service || '-' }}
                        </span>
                      </template>
                    </el-table-column>
                    <el-table-column label="类型" width="104" show-overflow-tooltip>
                      <template #default="{ row }">{{ traceNodeKindLabel(row) }}</template>
                    </el-table-column>
                    <el-table-column label="Detail" min-width="260" show-overflow-tooltip>
                      <template #default="{ row }">
                        {{ traceNodeMainDetail(row) || '-' }}
                      </template>
                    </el-table-column>
                    <el-table-column label="Duration" width="96">
                      <template #default="{ row }">{{ formatMs(row.durationMs) }}</template>
                    </el-table-column>
                    <el-table-column label="调用结果" width="92" align="center">
                      <template #default="{ row }">
                        <el-tag :type="row.error ? 'danger' : 'success'" size="small">{{ row.error ? '失败' : '成功' }}</el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="详情" width="74" align="center">
                      <template #default="{ row }">
                        <el-button type="primary" link size="small" @click="openTraceNodeDetail(row)">查看</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                    </aside>
                    <main class="trace-topology-panel">
                      <div ref="traceChartRef" class="trace-chart"></div>
                    </main>
                  </div>
                  </div>
                </el-drawer>

                <el-dialog v-model="traceNodeDetailVisible" title="调用节点详情" width="820px" class="trace-span-detail-dialog">
                  <div v-if="selectedTraceNode" class="span-detail-content">
                    <div class="span-detail-grid">
                      <InfoRow label="节点" :value="traceNodeBaseName(selectedTraceNode) || '-'" />
                      <InfoRow label="节点类型" :value="traceNodeKindLabel(selectedTraceNode)" />
                      <InfoRow label="Service" :value="selectedTraceNode.service || '-'" />
                      <InfoRow label="Endpoint" :value="selectedTraceNode.endpoint || '-'" />
                      <InfoRow label="Peer" :value="selectedTraceNode.peer || '-'" />
                      <InfoRow label="Duration" :value="formatMs(selectedTraceNode.durationMs)" />
                      <InfoRow label="Result" :value="selectedTraceNode.error ? '失败' : '成功'" />
                      <InfoRow label="Span Type" :value="selectedTraceNodeSpan?.type || '-'" />
                      <InfoRow label="Layer" :value="selectedTraceNodeSpan?.layer || '-'" />
                      <InfoRow label="Component" :value="selectedTraceNodeSpan?.component || '-'" />
                    </div>
                    <el-alert
                      v-if="selectedTraceNodeErrorMessage"
                      :title="selectedTraceNodeErrorMessage"
                      type="error"
                      show-icon
                      :closable="false"
                    />
                    <BlockViewer title="节点信息" :content="formatJson(JSON.stringify(selectedTraceNode || {}))" />
                    <BlockViewer v-if="selectedTraceNodeSpan?.httpUrl" title="HTTP URL" :content="selectedTraceNodeSpan.httpUrl" />
                    <BlockViewer v-if="selectedTraceNodeSpan?.sql" title="SQL" :content="selectedTraceNodeSpan.sql" />
                    <BlockViewer v-if="selectedTraceNodeSpan" title="Span 信息" :content="formatJson(JSON.stringify(selectedTraceNodeSpan || {}))" />
                    <BlockViewer v-if="selectedTraceNodeSpan" title="Tags" :content="formatJson(JSON.stringify(selectedTraceNodeSpan.tags || {}))" />
                  </div>
                </el-dialog>

                <el-drawer v-model="traceLogVisible" title="接口日志" size="82%" direction="rtl" class="trace-log-drawer">
                  <div class="trace-log-content">
                    <div class="trace-card-header">
                      <div>
                        <div class="payload-title">接口日志</div>
                        <div class="section-meta">
                          {{ traceLogs?.logs?.length || 0 }} logs
                        </div>
                      </div>
                      <el-button size="small" @click="traceLogVisible = false">Hide</el-button>
                    </div>
                    <el-alert
                      v-if="traceLogs?.errorMessage"
                      :title="traceLogs.errorMessage"
                      type="warning"
                      show-icon
                      :closable="false"
                    />
                    <el-table
                      v-else
                      v-loading="traceLogLoading"
                      :data="traceLogs?.logs || []"
                      size="small"
                      height="100%"
                      class="trace-log-table"
                    >
                      <el-table-column label="服务" prop="service" min-width="170" :show-overflow-tooltip="traceLogTooltipOptions">
                        <template #default="{ row }">{{ row.service || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="日志等级" prop="level" width="110" align="center">
                        <template #default="{ row }">
                          <el-tag :type="logLevelTagType(row.level)" size="small">{{ row.level || '-' }}</el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column label="日志内容" prop="content" min-width="360" :show-overflow-tooltip="traceLogTooltipOptions">
                        <template #default="{ row }">{{ row.content || '-' }}</template>
                      </el-table-column>
                      <el-table-column label="traceId" prop="traceId" min-width="240" :show-overflow-tooltip="traceLogTooltipOptions">
                        <template #default="{ row }">{{ row.traceId || '-' }}</template>
                      </el-table-column>
                    </el-table>
                  </div>
                </el-drawer>

                <div class="payload-grid">
                  <section class="payload-card">
                    <div class="payload-title">请求信息</div>
                    <InfoRow label="Method" :value="selectedExchange.method" />
                    <InfoRow label="URL" :value="selectedExchange.url" />
                    <InfoRow label="Request ID" :value="selectedExchange.requestId" />
                    <BlockViewer title="请求头" :content="formatJson(selectedExchange.requestHeaders)" />
                    <BlockViewer title="请求体" :content="decodeBody(selectedExchange.requestBodyBase64)" :truncated="selectedExchange.requestBodyTruncated" />
                  </section>

                  <section class="payload-card">
                    <div class="payload-title">应答信息</div>
                    <InfoRow label="Status" :value="String(selectedExchange.statusCode || '-')" />
                    <InfoRow label="耗时" :value="formatMs(selectedExchange.durationMs)" />
                    <InfoRow label="完成时间" :value="formatDateTime(selectedExchange.completedAt)" />
                    <BlockViewer title="响应头" :content="formatJson(selectedExchange.responseHeaders)" />
                    <BlockViewer title="响应体" :content="decodeBody(selectedExchange.responseBodyBase64)" :truncated="selectedExchange.responseBodyTruncated" />
                  </section>
                </div>
              </template>
            </main>
          </div>
        </el-tab-pane>
        <el-tab-pane label="根因分析" name="rootCause">
          <div class="root-cause-workspace">
            <aside class="root-cause-list">
              <div class="api-list-header">
                <div>
                  <div class="section-title">报错接口</div>
                  <div class="section-meta">{{ rootCauseErrorExchanges.length }} 条后端报错</div>
                </div>
                <el-button size="small" :loading="rootCauseLoading" @click="loadRootCause">刷新</el-button>
              </div>
              <el-skeleton v-if="rootCauseLoading && !rootCauseLoaded" :rows="8" animated />
              <el-empty v-else-if="rootCauseLoaded && rootCauseErrorExchanges.length === 0" description="该报告无后端报错接口" />
              <div v-else class="api-items">
                <button
                  v-for="item in rootCauseErrorExchanges"
                  :key="item.id || item.requestId"
                  class="api-item"
                  :class="{ active: selectedRootCauseExchange?.id === item.id }"
                  @click="selectedRootCauseExchange = item"
                >
                  <span class="method" :class="methodClass(item.method)">{{ item.method || '-' }}</span>
                  <span class="api-url">{{ shortUrl(item.url) }}</span>
                  <span class="api-meta">
                    <el-tag :type="statusTagType(item.statusCode)" size="small">{{ item.statusCode || 'ERR' }}</el-tag>
                    <span>{{ formatMs(item.durationMs) }}</span>
                    <span>{{ item.traceId || '-' }}</span>
                  </span>
                </button>
              </div>
            </aside>

            <main class="root-cause-detail">
              <el-empty v-if="rootCauseLoaded && rootCauseErrorExchanges.length === 0" description="该报告无后端报错接口" />
              <template v-else>
                <div class="trace-card-header">
                  <div>
                    <div class="payload-title">AI 根因分析</div>
                    <div class="section-meta">
                      {{ rootCauseStatusText }}
                    </div>
                  </div>
                  <el-button
                    type="primary"
                    :loading="rootCauseStreaming"
                    :disabled="rootCauseStreaming || !rootCauseLoaded || rootCauseErrorExchanges.length === 0"
                    @click="startRootCauseAnalysis"
                  >
                    {{ rootCauseCompleted ? '查看已完成分析' : '开始分析' }}
                  </el-button>
                </div>

                <el-alert v-if="rootCauseError" :title="rootCauseError" type="error" show-icon :closable="false" />
                <el-collapse v-if="rootCauseReasoning" v-model="rootCauseReasoningPanels" class="analysis-collapse">
                  <el-collapse-item title="模型思考过程" name="reasoning">
                    <div class="markdown-body reasoning-markdown" v-html="renderMarkdown(rootCauseReasoning)"></div>
                  </el-collapse-item>
                </el-collapse>
                <section class="analysis-block analysis-main">
                  <div class="analysis-title">分析结果</div>
                  <div v-if="rootCauseAnalysis" class="markdown-body" v-html="renderMarkdown(rootCauseAnalysis)"></div>
                  <el-empty v-else description="暂无分析结果" />
                </section>
              </template>
            </main>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { useReportStore } from '@/stores'
import { useProjectStore } from '@/stores/project'
import { getCaseDirectories, type CaseDirectory } from '@/api/cases'
import {
  getApiExchanges,
  getRootCauseAnalysis,
  getTraceLogs,
  getTraceTopology,
  streamRootCauseAnalysis,
  getReportContent,
  type ApiExchange,
  type RootCauseAnalysis,
  type TraceLogResponse,
  type TraceTopology,
} from '@/api/reports'
import { formatDate } from '@/utils'
import type { Report } from '@/types'

const InfoRow = defineComponent({
  props: { label: String, value: String },
  setup(props) {
    return () => h('div', { class: 'info-row' }, [
      h('span', props.label),
      h('strong', props.value || '-')
    ])
  }
})

const BlockViewer = defineComponent({
  props: { title: String, content: String, truncated: Boolean },
  setup(props) {
    return () => h('div', { class: 'block-viewer' }, [
      h('div', { class: 'block-title' }, [
        h('span', props.title),
        props.truncated ? h('em', '已截断') : null
      ]),
      h('pre', props.content || '-')
    ])
  }
})

const reportStore = useReportStore()
const projectStore = useProjectStore()
const directories = ref<CaseDirectory[]>([])
const directoryId = ref('')
const detailVisible = ref(false)
const activeTab = ref<'native' | 'api' | 'rootCause'>('native')
const selectedReport = ref<Report | null>(null)
const exchangeLoading = ref(false)
const exchanges = ref<ApiExchange[]>([])
const selectedExchange = ref<ApiExchange | null>(null)
const apiSearchKeyword = ref('')
const nativeReportLoading = ref(false)
const nativeReportError = ref('')
const nativeReportUrl = ref('')
const traceVisible = ref(false)
const traceLoading = ref(false)
const traceTopology = ref<TraceTopology | null>(null)
const traceLogVisible = ref(false)
const traceLogLoading = ref(false)
const traceLogs = ref<TraceLogResponse | null>(null)
const traceNodeDetailVisible = ref(false)
const selectedTraceNode = ref<TraceTopology['nodes'][number] | null>(null)
const traceLogTooltipOptions = {
  showAfter: 500,
  hideAfter: 100,
  popperClass: 'trace-log-tooltip-popper',
  placement: 'top',
  offset: 8,
}
const traceChartRef = ref<HTMLDivElement | null>(null)
const expandedTraceServices = ref<Set<string>>(new Set())
const rootCauseLoading = ref(false)
const rootCauseLoaded = ref(false)
const rootCauseStreaming = ref(false)
const rootCauseCompleted = ref(false)
const rootCauseReasoning = ref('')
const rootCauseReasoningPanels = ref<string[]>([])
const rootCauseAnalysis = ref('')
const rootCauseError = ref('')
const rootCauseErrorExchanges = ref<ApiExchange[]>([])
const selectedRootCauseExchange = ref<ApiExchange | null>(null)
let traceChart: echarts.ECharts | null = null
const serviceColors = ['#17a2a4', '#2f6fed', '#7c3aed', '#0f766e', '#b7791f', '#c2410c', '#be185d', '#4f46e5']
const dependencyTypes = ['database', 'redis', 'mq', 'dependency']
const traceChartPadding = { top: 96, right: 90, bottom: 56, left: 72 }
const middlewareSvg = {
  database: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><ellipse cx="32" cy="14" rx="22" ry="9" fill="#2563eb"/><path d="M10 14v28c0 5 10 9 22 9s22-4 22-9V14" fill="#60a5fa"/><path d="M10 28c0 5 10 9 22 9s22-4 22-9M10 42c0 5 10 9 22 9s22-4 22-9" fill="none" stroke="#1e40af" stroke-width="4"/><ellipse cx="32" cy="14" rx="22" ry="9" fill="none" stroke="#1e40af" stroke-width="4"/></svg>`,
  redis: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 7 55 18 32 29 9 18 32 7Z" fill="#ef4444"/><path d="M9 29 32 40 55 29v9L32 50 9 38v-9Z" fill="#f87171"/><path d="M9 18v9l23 12 23-12v-9L32 29 9 18Z" fill="#dc2626"/><path d="M18 18h28M24 14h16" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`,
  mq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="8" y="14" width="48" height="36" rx="6" fill="#f59e0b" stroke="#92400e" stroke-width="4"/><path d="M14 22h36M19 32h10M35 32h10M19 42h26" stroke="#fff7ed" stroke-width="4" stroke-linecap="round"/><circle cx="20" cy="22" r="3" fill="#92400e"/><circle cx="32" cy="22" r="3" fill="#92400e"/><circle cx="44" cy="22" r="3" fill="#92400e"/></svg>`,
  dependency: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="11" y="11" width="18" height="18" rx="4" fill="#64748b"/><rect x="35" y="11" width="18" height="18" rx="4" fill="#94a3b8"/><rect x="23" y="35" width="18" height="18" rx="4" fill="#475569"/><path d="M29 20h6M32 29v6" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/></svg>`,
}

const svgSymbol = (svg: string) => `image://data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
const middlewareSymbols: Record<string, string> = Object.fromEntries(
  Object.entries(middlewareSvg).map(([key, svg]) => [key, svgSymbol(svg)])
)
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] || char))

const serviceColor = (service?: string) => {
  const key = service || 'unknown'
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return serviceColors[hash % serviceColors.length]
}

const filteredExchanges = computed(() => {
  const keyword = apiSearchKeyword.value.trim().toLowerCase()
  if (!keyword) return exchanges.value

  return exchanges.value.filter(item => {
    const requestBody = decodeBody(item.requestBodyBase64).toLowerCase()
    const responseBody = decodeBody(item.responseBodyBase64).toLowerCase()
    return [
      item.url,
      item.method,
      item.requestHeaders,
      item.responseHeaders,
      requestBody,
      responseBody,
    ].some(value => (value || '').toLowerCase().includes(keyword))
  })
})

const filteredTraceSpans = computed(() => {
  return (traceTopology.value?.spans || []).filter(span => (span.layer || '').toLowerCase() !== 'unknown')
})

const traceTopologyNodes = computed(() => traceTopology.value?.nodes || [])

const selectedTraceNodeSpan = computed(() => {
  return selectedTraceNode.value ? spanForTraceNode(selectedTraceNode.value) : undefined
})

const selectedTraceNodeErrorMessage = computed(() => {
  return selectedTraceNode.value ? traceNodeErrorMessage(selectedTraceNode.value) : ''
})

const getStatusType = (s: string | undefined) => {
  if (!s) return 'info'
  const lower = s.toLowerCase()
  if (['success', 'passed', 'pass'].some(v => lower.includes(v))) return 'success'
  if (['failed', 'fail', 'error'].some(v => lower.includes(v))) return 'danger'
  if (['running', 'pending', 'executing'].some(v => lower.includes(v))) return 'warning'
  return 'info'
}

const getStatusName = (s: string | undefined) => {
  if (!s) return '-'
  const lower = s.toLowerCase()
  if (['success', 'passed', 'pass'].some(v => lower.includes(v))) return '成功'
  if (['failed', 'fail', 'error'].some(v => lower.includes(v))) return '失败'
  if (['running', 'executing'].some(v => lower.includes(v))) return '执行中'
  if (lower.includes('pending')) return '等待中'
  return s
}

const formatDateTime = (d: string | undefined) => d ? formatDate(d, 'YYYY-MM-DD HH:mm:ss') : '-'
const formatTime = (d: string | undefined) => d ? formatDate(d, 'HH:mm:ss') : '-'
const formatDuration = (ms: number | undefined) => {
  if (!ms && ms !== 0) return '-'
  const totalSec = Math.round(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  if (totalSec < 3600) return `${Math.floor(totalSec / 60)}m ${totalSec % 60}s`
  return `${Math.floor(totalSec / 3600)}h ${Math.floor((totalSec % 3600) / 60)}m`
}
const formatMs = (ms: number | undefined) => (ms || ms === 0) ? `${ms} ms` : '-'

const logLevelTagType = (level?: string) => {
  const normalized = (level || '').toUpperCase()
  if (['ERROR', 'FATAL'].includes(normalized)) return 'danger'
  if (normalized === 'WARN') return 'warning'
  if (normalized === 'INFO') return 'success'
  if (['DEBUG', 'TRACE'].includes(normalized)) return 'info'
  return 'info'
}

const copyTraceId = async (traceId?: string) => {
  if (!traceId) return
  try {
    await navigator.clipboard.writeText(traceId)
    ElMessage.success('Trace ID copied')
  } catch {
    ElMessage.error('Trace ID copy failed')
  }
}

const resetRootCauseState = () => {
  rootCauseLoading.value = false
  rootCauseLoaded.value = false
  rootCauseStreaming.value = false
  rootCauseCompleted.value = false
  rootCauseReasoning.value = ''
  rootCauseReasoningPanels.value = []
  rootCauseAnalysis.value = ''
  rootCauseError.value = ''
  rootCauseErrorExchanges.value = []
  selectedRootCauseExchange.value = null
}

const openReportDetail = async (row: Report, tab: 'native' | 'api' | 'rootCause') => {
  selectedReport.value = row
  activeTab.value = tab
  detailVisible.value = true
  nativeReportUrl.value = ''
  nativeReportError.value = ''
  resetRootCauseState()
  if (tab === 'native') await checkNativeReport()
  if (tab === 'api') await reloadExchanges()
  if (tab === 'rootCause') await loadRootCause()
}

const checkNativeReport = async () => {
  if (nativeReportUrl.value) {
    URL.revokeObjectURL(nativeReportUrl.value)
    nativeReportUrl.value = ''
  }
  nativeReportError.value = ''
  if (!selectedReport.value?.result) return

  nativeReportLoading.value = true
  try {
    const html = await getReportContent(selectedReport.value.result)
    const response = { ok: Boolean(html), status: html ? 200 : 404 }
    if (!response.ok) {
      nativeReportError.value = response.status === 404
        ? '平台未找到该执行ID对应的归档 HTML 文件，通常是报告未成功回传、文件被清理，或平台容器未持久化报告目录。'
        : `报告文件访问失败，HTTP ${response.status}`
      return
    }
    nativeReportUrl.value = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  } catch (error: any) {
    nativeReportError.value = error?.message || '报告文件访问失败'
  } finally {
    nativeReportLoading.value = false
  }
}

const openNativeReportWindow = () => {
  if (nativeReportUrl.value) window.open(nativeReportUrl.value, '_blank', 'noopener,noreferrer')
}

const reloadExchanges = async () => {
  if (!selectedReport.value?.id) {
    exchanges.value = []
    selectedExchange.value = null
    return
  }
  exchangeLoading.value = true
  try {
    exchanges.value = (await getApiExchanges(selectedReport.value.id)) || []
    selectFirstFilteredExchange()
  } catch {
    exchanges.value = []
    selectedExchange.value = null
    ElMessage.error('接口记录加载失败')
  } finally {
    exchangeLoading.value = false
  }
}

const loadTraceTopology = async () => {
  if (!selectedExchange.value?.id) return
  traceLoading.value = true
  traceVisible.value = true
  try {
    traceTopology.value = await getTraceTopology(selectedExchange.value.id)
    expandedTraceServices.value = new Set()
    traceChart?.clear()
    await nextTick()
    renderTraceChart()
  } catch {
    traceTopology.value = null
    ElMessage.error('Trace topology load failed')
  } finally {
    traceLoading.value = false
  }
}

const loadTraceLogs = async () => {
  if (!selectedExchange.value?.id) return
  traceLogLoading.value = true
  traceLogVisible.value = true
  try {
    traceLogs.value = await getTraceLogs(selectedExchange.value.id)
  } catch {
    traceLogs.value = null
    ElMessage.error('接口日志加载失败')
  } finally {
    traceLogLoading.value = false
  }
}

const openTraceNodeDetail = (node: TraceTopology['nodes'][number]) => {
  selectedTraceNode.value = node
  traceNodeDetailVisible.value = true
}

const applyRootCauseResponse = (data: RootCauseAnalysis | null) => {
  rootCauseErrorExchanges.value = data?.errorExchanges || []
  selectedRootCauseExchange.value = rootCauseErrorExchanges.value[0] || null
  rootCauseCompleted.value = !!data?.completed
  rootCauseReasoning.value = data?.reasoning || ''
  rootCauseAnalysis.value = data?.analysis || ''
  rootCauseError.value = data?.errorMessage || ''
}

const loadRootCause = async () => {
  if (!selectedReport.value?.id) return
  rootCauseLoading.value = true
  try {
    const data = await getRootCauseAnalysis(selectedReport.value.id)
    applyRootCauseResponse(data)
    rootCauseLoaded.value = true
  } catch (error: any) {
    rootCauseError.value = error?.message || '根因分析加载失败'
    rootCauseLoaded.value = true
  } finally {
    rootCauseLoading.value = false
  }
}

const startRootCauseAnalysis = async () => {
  if (!selectedReport.value?.id) return
  if (rootCauseCompleted.value) {
    await loadRootCause()
    return
  }
  rootCauseStreaming.value = true
  rootCauseError.value = ''
  rootCauseReasoning.value = ''
  rootCauseAnalysis.value = ''
  try {
    const complete = await streamRootCauseAnalysis(
      selectedReport.value.id,
      chunk => { rootCauseAnalysis.value += chunk },
      chunk => { rootCauseReasoning.value += chunk },
    )
    if (complete) rootCauseAnalysis.value = complete
    rootCauseCompleted.value = true
    await loadRootCause()
  } catch (error: any) {
    rootCauseError.value = error?.message || '根因分析失败'
    ElMessage.error(rootCauseError.value)
  } finally {
    rootCauseStreaming.value = false
  }
}

const rootCauseStatusText = computed(() => {
  if (rootCauseStreaming.value) return '模型分析中，正在流式输出'
  if (!rootCauseLoaded.value) return '尚未加载'
  if (rootCauseErrorExchanges.value.length === 0) return '该报告无后端报错接口'
  if (rootCauseCompleted.value) return '已完成，读取缓存分析结果'
  return '首次分析会流式展示并保存结果'
})

const escapeMarkdownHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

const renderInlineMarkdown = (value: string) => {
  return escapeMarkdownHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

const renderMarkdown = (value: string) => {
  const lines = (value || '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let inList = false

  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }

  for (const line of lines) {
    const fence = line.match(/^```/)
    if (fence) {
      closeList()
      html.push(inCode ? '</code></pre>' : '<pre><code>')
      inCode = !inCode
      continue
    }
    if (inCode) {
      html.push(`${escapeMarkdownHtml(line)}\n`)
      continue
    }
    if (!line.trim()) {
      closeList()
      html.push('<br/>')
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`)
      continue
    }
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`)
      continue
    }
    closeList()
    html.push(`<p>${renderInlineMarkdown(line)}</p>`)
  }
  closeList()
  if (inCode) html.push('</code></pre>')
  return html.join('')
}

const renderTraceChart = () => {
  if (!traceChartRef.value || !traceTopology.value || traceTopology.value.errorMessage) return
  if (!traceChart) traceChart = echarts.init(traceChartRef.value)

  const expanded = expandedTraceServices.value
  const chartWidth = traceChartRef.value.clientWidth || 980
  const chartHeight = traceChartRef.value.clientHeight || 620
  const sourceNodes = traceTopology.value.nodes.filter(node => {
    if (!['database', 'redis', 'mq', 'dependency'].includes(node.type)) return true
    return !!node.service && expanded.has(node.service)
  })
  const visibleIds = new Set(sourceNodes.map(node => node.id))
  const sourceEdges = traceTopology.value.edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target))
  const dependencyByService = new Map<string, number>()
  traceTopology.value.nodes.forEach(node => {
    if (dependencyTypes.includes(node.type) && node.service) {
      dependencyByService.set(node.service, (dependencyByService.get(node.service) || 0) + 1)
    }
  })
  const mainNodes = sourceNodes.filter(node => node.type === 'api' || node.type === 'service')
  const mainOrder = orderTraceMainNodes(mainNodes, traceTopology.value.edges)
  const positionById = new Map<string, { x: number; y: number }>()
  const colWidth = 260
  const rowHeight = 170
  const maxCols = Math.max(2, Math.min(5, Math.floor(chartWidth / colWidth)))
  mainOrder.forEach((node, index) => {
    positionById.set(node.id, { x: 130 + (index % maxCols) * colWidth, y: 150 + Math.floor(index / maxCols) * rowHeight })
  })
  const serviceDependencyIndex = new Map<string, number>()
  sourceNodes.forEach(node => {
    if (!dependencyTypes.includes(node.type)) return
    const parent = node.service ? traceTopology.value!.nodes.find(n => n.type === 'service' && n.service === node.service) : undefined
    const parentPos = parent ? positionById.get(parent.id) : undefined
    if (!parentPos || !node.service) return
    const index = serviceDependencyIndex.get(node.service) || 0
    serviceDependencyIndex.set(node.service, index + 1)
    const cols = 3
    const gapX = 96
    const gapY = 82
    const col = index % cols
    const row = Math.floor(index / cols)
    positionById.set(node.id, { x: parentPos.x + (col - 1) * gapX, y: parentPos.y + 92 + row * gapY })
  })
  const positions = Array.from(positionById.values())
  const bounds = positions.reduce((acc, pos) => ({
    minX: Math.min(acc.minX, pos.x),
    maxX: Math.max(acc.maxX, pos.x),
    minY: Math.min(acc.minY, pos.y),
    maxY: Math.max(acc.maxY, pos.y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })
  if (Number.isFinite(bounds.minX)) {
    const graphWidth = Math.max(1, bounds.maxX - bounds.minX)
    const graphHeight = Math.max(1, bounds.maxY - bounds.minY)
    const availableWidth = Math.max(1, chartWidth - traceChartPadding.left - traceChartPadding.right)
    const availableHeight = Math.max(1, chartHeight - traceChartPadding.top - traceChartPadding.bottom)
    const fitScale = Math.min(1, availableWidth / graphWidth, availableHeight / graphHeight)
    const offsetX = traceChartPadding.left + (availableWidth - graphWidth * fitScale) / 2 - bounds.minX * fitScale
    const offsetY = traceChartPadding.top + (availableHeight - graphHeight * fitScale) / 2 - bounds.minY * fitScale
    positionById.forEach((pos, id) => {
      positionById.set(id, { x: pos.x * fitScale + offsetX, y: pos.y * fitScale + offsetY })
    })
  }

  const categories = [
    { name: 'API' },
    { name: 'Service' },
    { name: 'Database' },
    { name: 'Redis' },
    { name: 'MQ' },
    { name: 'Dependency' },
  ]
  const categoryIndex = (type?: string) => {
    if (type === 'api') return 0
    if (type === 'service') return 1
    if (type === 'database') return 2
    if (type === 'redis') return 3
    if (type === 'mq') return 4
    return 5
  }
  const colorByType: Record<string, string> = {
    api: '#2f6fed',
    database: '#dbeafe',
    redis: '#fee2e2',
    mq: '#fef3c7',
    dependency: '#e2e8f0',
  }

  traceChart.setOption({
    tooltip: {
      trigger: 'item',
      confine: true,
      extraCssText: 'max-width: min(520px, calc(100vw - 48px)); max-height: min(420px, calc(100vh - 48px)); overflow: auto; white-space: normal; word-break: break-word;',
      formatter: (params: any) => {
        const data = params.data || {}
        if (params.dataType === 'edge') {
          const status = data.error ? '<br/>Status: <span style="color:#fca5a5;font-weight:700">ERROR</span>' : '<br/>Status: OK'
          const error = data.errorMessage ? `<br/>Error: ${escapeHtml(data.errorMessage)}` : ''
          return `${escapeHtml(data.operation || data.type || 'call')}<br/>Duration: ${escapeHtml(formatMs(data.durationMs))}${status}${error}`
        }
        const expandHint = data.type === 'service' && data.service && dependencyByService.has(data.service)
          ? `<br/>${expanded.has(data.service) ? '点击收起中间件调用' : `点击展开 ${dependencyByService.get(data.service)} 个中间件调用`}`
          : ''
        const service = data.service ? `<br/>Service: ${escapeHtml(data.service)}` : ''
        const peer = data.peer ? `<br/>Peer: ${escapeHtml(data.peer)}` : ''
        const detail = data.detail ? `<br/>${escapeHtml(data.detailLabel || 'Detail')}: ${escapeHtml(data.detail)}` : ''
        const status = data.error ? '<br/>Status: <span style="color:#fca5a5;font-weight:700">ERROR</span>' : '<br/>Status: OK'
        const error = data.errorMessage ? `<br/>Error: ${escapeHtml(data.errorMessage)}` : ''
        return `${escapeHtml(data.tooltipName || data.name)}<br/>Type: ${escapeHtml(data.type || '-')}${service}${peer}${detail}<br/>Duration: ${escapeHtml(formatMs(data.durationMs))}${status}${error}${expandHint}`
      },
    },
    legend: [{ data: categories.map(item => item.name), top: 0 }],
    series: [{
      type: 'graph',
      layout: 'none',
      roam: true,
      categories,
      label: { show: true, position: 'right', formatter: '{b}', color: '#253044', fontSize: 12 },
      edgeSymbol: ['none', 'arrow'],
      edgeSymbolSize: 8,
      lineStyle: { color: '#8a94a6', width: 1.5, curveness: 0.08 },
      emphasis: { focus: 'adjacency' },
      data: sourceNodes.map(node => ({
        ...node,
        ...(positionById.get(node.id) || {}),
        category: categoryIndex(node.type),
        name: traceNodeDisplayNameWithStatus(node, dependencyByService, expanded),
        tooltipName: traceNodeTooltipName(node),
        symbol: node.type === 'api' || node.type === 'service' ? 'circle' : middlewareSymbols[node.type] || middlewareSymbols.dependency,
        symbolSize: node.type === 'api' ? 66 : node.type === 'service' ? 60 : 42,
        itemStyle: {
          color: node.error ? '#d93025' : node.type === 'service' ? serviceColor(node.service) : colorByType[node.type] || '#6b7280',
          borderColor: node.error ? '#7f1d1d' : node.type === 'service' && node.service && dependencyByService.has(node.service) && !expanded.has(node.service) ? '#111827' : '#ffffff',
          borderWidth: node.error ? 4 : node.type === 'service' && node.service && dependencyByService.has(node.service) && !expanded.has(node.service) ? 3 : 1,
          shadowBlur: node.error ? 12 : 0,
          shadowColor: node.error ? 'rgba(217,48,37,.45)' : 'transparent',
        },
        label: {
          fontWeight: node.type === 'api' || node.type === 'service' ? 700 : 500,
          formatter: node.type === 'service' && node.service && dependencyByService.has(node.service) && !expanded.has(node.service)
            ? '{b}\n可展开'
            : '{b}',
        },
        detailLabel: traceNodeDetailLabel(node),
        detail: traceNodeMainDetail(node),
        errorMessage: traceNodeErrorMessage(node),
      })),
      links: sourceEdges.map(edge => ({
        ...edge,
        label: { show: edge.type === 'service' || edge.type === 'entry', formatter: edge.operation || edge.type, fontSize: 11, color: '#526070' },
        lineStyle: { color: edge.error ? '#d93025' : '#8a94a6', width: edge.type === 'service' || edge.type === 'entry' ? 2.8 : 1.2, curveness: 0.08, opacity: edge.type === 'service' || edge.type === 'entry' ? 0.95 : 0.55 },
      })),
    }],
  })
  traceChart.off('click')
  traceChart.on('click', (params: any) => {
    const node = params?.data
    if (params.dataType !== 'node' || node?.type !== 'service' || !node.service) return
    const next = new Set(expandedTraceServices.value)
    if (next.has(node.service)) next.delete(node.service)
    else next.add(node.service)
    expandedTraceServices.value = next
    renderTraceChart()
  })
  traceChart.resize()
}

const expandAllServices = () => {
  expandedTraceServices.value = new Set((traceTopology.value?.nodes || []).filter(node => node.type === 'service' && node.service).map(node => node.service!))
  renderTraceChart()
}

const orderTraceMainNodes = (nodes: TraceTopology['nodes'], edges: TraceTopology['edges']) => {
  const nodeById = new Map(nodes.map(node => [node.id, node]))
  const incomingCount = new Map(nodes.map(node => [node.id, 0]))
  const children = new Map<string, string[]>()
  edges
    .filter(edge => nodeById.has(edge.source) && nodeById.has(edge.target) && (edge.type === 'entry' || edge.type === 'service'))
    .forEach(edge => {
      children.set(edge.source, [...(children.get(edge.source) || []), edge.target])
      incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1)
    })

  const roots = nodes
    .filter(node => node.type === 'api' || (incomingCount.get(node.id) || 0) === 0)
    .sort((a, b) => (a.type === 'api' ? -1 : b.type === 'api' ? 1 : a.name.localeCompare(b.name)))
  const ordered: TraceTopology['nodes'] = []
  const visited = new Set<string>()
  const visit = (node: TraceTopology['nodes'][number]) => {
    if (visited.has(node.id)) return
    visited.add(node.id)
    ordered.push(node)
    ;(children.get(node.id) || [])
      .map(id => nodeById.get(id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name))
      .forEach(child => visit(child!))
  }
  roots.forEach(visit)
  nodes.filter(node => !visited.has(node.id)).sort((a, b) => a.name.localeCompare(b.name)).forEach(visit)
  return ordered
}

const collapseAllServices = () => {
  expandedTraceServices.value = new Set()
  renderTraceChart()
}

const traceSpanKind = (span: any) => {
  const layer = (span.layer || '').toLowerCase()
  const type = (span.type || '').toUpperCase()
  const component = (span.component || '').toLowerCase()
  if (layer.includes('http') || type === 'ENTRY' || span.httpUrl || component.includes('http') || component.includes('feign')) return 'http'
  if (layer.includes('database') || component.includes('jdbc') || component.includes('mysql') || component.includes('postgres') || component.includes('oracle') || component.includes('mongo')) return 'database'
  if (component.includes('redis') || layer.includes('cache')) return 'redis'
  if (component.includes('kafka') || component.includes('rabbit') || component.includes('rocketmq') || component.includes('activemq') || layer.includes('mq')) return 'mq'
  return span.sql ? 'database' : 'operation'
}

const spanMainDetail = (span: any) => {
  const kind = traceSpanKind(span)
  if (kind === 'http') return span.httpUrl || span.endpoint || '-'
  if (kind === 'database') return span.sql || span.endpoint || span.peer || '-'
  return span.endpoint || span.peer || '-'
}

const spanDetailLabel = (span: any) => {
  const kind = traceSpanKind(span)
  if (kind === 'database') return 'SQL'
  if (kind === 'http') return 'URL'
  return 'OP'
}

const spanForTraceNode = (node: any) => {
  const spans = filteredTraceSpans.value
  if (node.type === 'api') return undefined
  if (['database', 'redis', 'mq', 'dependency'].includes(node.type)) {
    return spans.find(span =>
      span.service === node.service &&
      ((node.peer && span.peer === node.peer) || (node.endpoint && span.endpoint === node.endpoint))
    )
  }
  return spans.find(span => span.service === node.service && (span.type === 'ENTRY' || span.endpoint === node.endpoint))
    || spans.find(span => span.service === node.service)
}

const traceNodeMainDetail = (node: any) => {
  if (node.type === 'api') return node.endpoint || selectedExchange.value?.url || ''
  const span = spanForTraceNode(node)
  return span ? spanMainDetail(span) : (node.endpoint || node.peer || '')
}

const traceNodeDetailLabel = (node: any) => {
  if (node.type === 'api') return 'URL'
  const span = spanForTraceNode(node)
  if (span) return spanDetailLabel(span)
  if (node.type === 'database') return 'SQL'
  if (node.type === 'redis' || node.type === 'mq') return 'OP'
  return 'Detail'
}

const traceNodeKindLabel = (node: any) => {
  if (node.type === 'database') return 'Database'
  if (node.type === 'redis') return 'Redis'
  if (node.type === 'mq') return 'Message Queue'
  if (node.type === 'dependency') return 'Dependency'
  if (node.type === 'api') return 'API'
  return 'Service'
}

const dependencyBackendName = (node: any) => {
  const span = spanForTraceNode(node)
  const text = `${span?.component || ''} ${node.peer || ''} ${node.endpoint || ''}`.toLowerCase()
  if (text.includes('mysql')) return 'MySQL'
  if (text.includes('postgres')) return 'PostgreSQL'
  if (text.includes('oracle')) return 'Oracle'
  if (text.includes('mongo')) return 'MongoDB'
  if (text.includes('redis')) return 'Redis'
  if (text.includes('kafka')) return 'Kafka'
  if (text.includes('rabbit')) return 'RabbitMQ'
  if (text.includes('rocketmq')) return 'RocketMQ'
  if (text.includes('activemq')) return 'ActiveMQ'
  return traceNodeKindLabel(node)
}

const traceNodeBaseName = (node: any) => {
  if (dependencyTypes.includes(node.type)) {
    const target = node.peer || node.endpoint || node.name || ''
    return target ? `${dependencyBackendName(node)} · ${target}` : dependencyBackendName(node)
  }
  return node.name
}

const traceNodeDisplayName = (node: any, dependencyByService: Map<string, number>, expanded: Set<string>) => {
  const name = traceNodeBaseName(node)
  if (node.type === 'service' && node.service && dependencyByService.has(node.service) && !expanded.has(node.service)) {
    return `${name}  +${dependencyByService.get(node.service)}`
  }
  return name
}

const traceNodeDisplayNameWithStatus = (node: any, dependencyByService: Map<string, number>, expanded: Set<string>) => {
  return `${traceNodeDisplayName(node, dependencyByService, expanded)}\n${node.error ? '异常' : '正常'}`
}

const traceNodeErrorMessage = (node: any) => {
  if (node.errorMessage) return node.errorMessage
  if (node.type === 'api') return selectedExchange.value?.errorMessage || ''
  const messages = filteredTraceSpans.value
    .filter((span: any) => {
      if (!span.error || !span.errorMessage) return false
      if (node.type === 'service') return span.service === node.service
      return span.service === node.service && ((node.peer && span.peer === node.peer) || (node.endpoint && span.endpoint === node.endpoint))
    })
    .map((span: any) => span.errorMessage)
  return Array.from(new Set(messages)).join('\n')
}

const traceNodeTooltipName = (node: any) => traceNodeBaseName(node)

watch(activeTab, tab => {
  if (tab === 'native' && detailVisible.value && selectedReport.value?.result && !nativeReportUrl.value && !nativeReportLoading.value) {
    checkNativeReport()
  }
  if (tab === 'api' && detailVisible.value && exchanges.value.length === 0 && !exchangeLoading.value) {
    reloadExchanges()
  }
  if (tab === 'rootCause' && detailVisible.value && !rootCauseLoaded.value && !rootCauseLoading.value) {
    loadRootCause()
  }
})

watch(selectedExchange, () => {
  traceVisible.value = false
  traceTopology.value = null
  traceLogVisible.value = false
  traceLogs.value = null
  traceNodeDetailVisible.value = false
  selectedTraceNode.value = null
  traceChart?.clear()
})

watch(detailVisible, visible => {
  if (!visible) {
    if (nativeReportUrl.value) {
      URL.revokeObjectURL(nativeReportUrl.value)
      nativeReportUrl.value = ''
    }
    traceVisible.value = false
    traceTopology.value = null
    traceLogVisible.value = false
    traceLogs.value = null
    traceNodeDetailVisible.value = false
    selectedTraceNode.value = null
    resetRootCauseState()
    traceChart?.clear()
  }
})

watch(traceVisible, async visible => {
  if (!visible) return
  await nextTick()
  traceChart?.resize()
  renderTraceChart()
})

const selectFirstFilteredExchange = () => {
  selectedExchange.value = filteredExchanges.value[0] || null
}

const deleteReport = async (row: Report) => {
  try {
    await ElMessageBox.confirm('确定删除该报告吗？', '删除确认', { type: 'warning' })
    await reportStore.removeReport(row.id!)
    ElMessage.success('删除成功')
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

const handleRefresh = () => {
  reportStore.page = 1
  reportStore.fetchReports({ projectId: projectStore.currentProject?.id, directoryId: directoryId.value || undefined })
}

const onPageChange = (page: number) => {
  reportStore.fetchReports({ page, size: reportStore.size, projectId: projectStore.currentProject?.id, directoryId: directoryId.value || undefined })
}

const onSizeChange = (size: number) => {
  reportStore.page = 1
  reportStore.fetchReports({ page: 1, size, projectId: projectStore.currentProject?.id, directoryId: directoryId.value || undefined })
}

const statusTagType = (status?: number) => {
  if (!status) return 'danger'
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'warning'
  return 'danger'
}
const methodTagType = (method?: string) => method === 'GET' ? 'success' : method === 'POST' ? 'primary' : method === 'DELETE' ? 'danger' : 'info'
const methodClass = (method?: string) => `method-${(method || 'other').toLowerCase()}`
const shortUrl = (url?: string) => {
  if (!url) return '-'
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}

const formatJson = (raw?: string) => {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

const decodeBody = (raw?: string) => {
  if (!raw) return ''
  try {
    const binary = atob(raw)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const text = new TextDecoder('utf-8').decode(bytes)
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  } catch {
    return raw
  }
}

watch(() => projectStore.currentProject?.id, async id => {
  directoryId.value = ''
  directories.value = id ? await getCaseDirectories(id) : []
  handleRefresh()
})

onMounted(async () => {
  if (projectStore.currentProject?.id) directories.value = await getCaseDirectories(projectStore.currentProject.id)
  handleRefresh()
})

onBeforeUnmount(() => {
  if (nativeReportUrl.value) URL.revokeObjectURL(nativeReportUrl.value)
  traceChart?.dispose()
  traceChart = null
})
</script>

<style lang="scss" scoped>
.reports-view { display: flex; flex-direction: column; gap: 16px; }
.page-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  background: #fff; padding: 18px 20px; border-radius: 8px; box-shadow: 0 2px 12px rgba(20, 32, 54, .08);
}
.page-title { font-size: 18px; font-weight: 700; color: #1f2d3d; }
.page-subtitle { margin-top: 4px; font-size: 12px; color: #7b8494; }
.report-panel { background: #fff; border-radius: 8px; padding: 18px; box-shadow: 0 2px 12px rgba(20, 32, 54, .08); }
.filter-row { display: flex; justify-content: flex-end; margin-bottom: 14px; }
.directory-filter { width: 220px; }
.reports-table {
  width: 100%;
  :deep(.el-table__header th) { background: #f6f8fb; color: #4b5563; font-weight: 700; }
  :deep(.el-table__row) { height: 58px; }
}
.report-name { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.report-name-main { font-weight: 600; color: #243044; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.report-name-meta { font-size: 12px; color: #8a94a6; }
.pagination-wrap { display: flex; justify-content: center; padding: 20px 0 4px; }

:deep(.report-detail-drawer .el-drawer__body) { padding: 0 20px 20px; background: #f5f7fb; }
.report-tabs { height: 100%; }
.native-report-frame { height: calc(100vh - 150px); background: #fff; border: 1px solid #e4e7ed; border-radius: 8px; overflow: hidden; }
.native-report-frame iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.native-report-state {
  min-height: calc(100vh - 150px);
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.native-report-state :deep(.el-skeleton) { width: min(920px, 100%); }
.api-workspace { display: grid; grid-template-columns: 390px minmax(0, 1fr); gap: 16px; height: calc(100vh - 150px); }
.api-list, .api-detail { background: #fff; border: 1px solid #e6eaf0; border-radius: 8px; min-height: 0; }
.api-list { display: flex; flex-direction: column; overflow: hidden; }
.api-list-header { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #edf0f5; }
.section-title { font-size: 15px; font-weight: 700; color: #263445; }
.section-meta { margin-top: 3px; font-size: 12px; color: #8a94a6; }
.api-items { overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 8px; }
.api-item {
  border: 1px solid #e7ebf2; background: #fff; border-radius: 8px; padding: 10px; display: grid;
  grid-template-columns: 62px minmax(0, 1fr); gap: 8px 10px; text-align: left; cursor: pointer;
}
.api-item:hover, .api-item.active { border-color: #409eff; background: #f0f7ff; }
.method { font-size: 12px; font-weight: 800; color: #606266; }
.method-get { color: #1f9d55; } .method-post { color: #2f6fed; } .method-put { color: #b7791f; } .method-delete { color: #d93025; }
.api-url { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #253044; font-weight: 600; }
.api-meta { grid-column: 2; display: flex; align-items: center; gap: 10px; font-size: 12px; color: #7b8494; }
.api-detail { padding: 16px; overflow: auto; }
.root-cause-workspace { display: grid; grid-template-columns: 390px minmax(0, 1fr); gap: 16px; height: calc(100vh - 150px); }
.root-cause-list,
.root-cause-detail { background: #fff; border: 1px solid #e6eaf0; border-radius: 8px; min-height: 0; }
.root-cause-list { display: flex; flex-direction: column; overflow: hidden; }
.root-cause-detail { padding: 16px; overflow: auto; }
.analysis-block { border: 1px solid #e6eaf0; border-radius: 8px; background: #fbfcfe; padding: 14px; margin-top: 14px; }
.analysis-title { font-size: 14px; font-weight: 700; color: #263445; margin-bottom: 10px; }
.analysis-collapse { margin-top: 14px; border: 1px solid #e6eaf0; border-radius: 8px; overflow: hidden; background: #fbfcfe; }
.analysis-collapse :deep(.el-collapse-item__header) { padding: 0 14px; font-weight: 700; color: #263445; background: #fbfcfe; }
.analysis-collapse :deep(.el-collapse-item__content) { padding: 0 14px 14px; }
.markdown-body {
  color: #253044;
  font-size: 13px;
  line-height: 1.75;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4 { margin: 14px 0 8px; color: #1f2d3d; line-height: 1.35; }
.markdown-body h1 { font-size: 20px; }
.markdown-body h2 { font-size: 18px; }
.markdown-body h3 { font-size: 16px; }
.markdown-body h4 { font-size: 14px; }
.markdown-body p { margin: 8px 0; }
.markdown-body ul { margin: 8px 0 8px 18px; padding: 0; }
.markdown-body li { margin: 5px 0; }
.markdown-body code {
  padding: 2px 5px;
  border-radius: 4px;
  background: #eef2f7;
  color: #be123c;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.markdown-body pre {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: #111827;
  color: #dbeafe;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.markdown-body pre code { padding: 0; background: transparent; color: inherit; }
.reasoning-markdown { color: #526070; }
.analysis-main { min-height: 360px; }
.detail-heading { display: flex; justify-content: space-between; gap: 14px; padding-bottom: 14px; border-bottom: 1px solid #edf0f5; margin-bottom: 14px; }
.detail-actions { flex: 0 0 auto; display: flex; align-items: flex-start; }
.detail-url { font-size: 15px; font-weight: 700; color: #1f2d3d; word-break: break-all; }
.detail-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; color: #7b8494; font-size: 12px; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.metric { border: 1px solid #e8edf4; background: #fbfcfe; border-radius: 8px; padding: 12px; min-width: 0; }
.metric span { display: block; color: #7b8494; font-size: 12px; margin-bottom: 6px; }
.metric strong { display: block; color: #243044; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trace-id-metric { grid-column: span 2; }
.trace-id-row { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.trace-id-value {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  overflow: visible !important;
  text-overflow: clip !important;
  white-space: normal !important;
  overflow-wrap: anywhere;
  word-break: break-all;
  line-height: 1.45;
}
.trace-id-copy { flex: 0 0 auto; padding: 0; }
.payload-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 14px; }
.payload-card { border: 1px solid #e6eaf0; border-radius: 8px; padding: 14px; min-width: 0; }
.payload-title { font-size: 15px; font-weight: 700; color: #263445; margin-bottom: 12px; }
.trace-card { border: 1px solid #e6eaf0; border-radius: 8px; padding: 14px; margin: 14px 0; background: #fff; }
:deep(.trace-fullscreen-drawer .el-drawer__body) { padding: 0; background: #f5f7fb; overflow: hidden; }
.trace-drawer-content { height: 100%; min-height: 0; padding: 14px; display: flex; flex-direction: column; }
.trace-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
.trace-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.trace-workspace { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(520px, 44%) minmax(0, 1fr); gap: 14px; }
.trace-span-panel,
.trace-topology-panel { min-width: 0; min-height: 0; background: #fff; border: 1px solid #e6eaf0; border-radius: 8px; overflow: hidden; }
.trace-span-panel { padding: 8px; }
.trace-topology-panel { padding: 10px; }
.trace-chart { width: 100%; height: 100%; min-height: 0; background: #fbfcfe; }
.trace-span-table { height: 100%; }
.span-detail-content { display: flex; flex-direction: column; gap: 12px; }
.span-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 14px;
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  padding: 10px 12px;
  background: #fbfcfe;
}
.trace-span-detail-dialog :deep(.block-viewer pre) { max-height: 220px; }
.trace-log-drawer :deep(.el-drawer__body) { padding: 0; background: #f5f7fb; overflow: hidden; }
.trace-log-content { height: 100%; min-height: 0; padding: 14px; display: flex; flex-direction: column; }
.trace-log-table { flex: 1; min-height: 0; background: #fff; border: 1px solid #e6eaf0; border-radius: 8px; overflow: hidden; }
.service-cell { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.service-dot { width: 10px; height: 10px; border-radius: 50%; flex: 0 0 auto; box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 0 0 3px rgba(31,45,61,.08); }
.span-detail-label { display: inline-flex; min-width: 32px; margin-right: 8px; color: #7b8494; font-weight: 700; }
:deep(.info-row) { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 12px; padding: 7px 0; border-bottom: 1px dashed #edf0f5; }
:deep(.info-row span) { color: #7b8494; font-size: 12px; }
:deep(.info-row strong) { color: #263445; font-size: 12px; word-break: break-all; }
:deep(.block-viewer) { margin-top: 12px; }
:deep(.block-title) { display: flex; justify-content: space-between; color: #526070; font-size: 12px; font-weight: 700; margin-bottom: 6px; }
:deep(.block-title em) { color: #e6a23c; font-style: normal; font-weight: 600; }
:deep(.block-viewer pre) {
  margin: 0; min-height: 92px; max-height: 260px; overflow: auto; padding: 12px; border-radius: 8px;
  background: #111827; color: #dbeafe; font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
}

@media (max-width: 1100px) {
  .api-workspace { grid-template-columns: 1fr; height: auto; }
  .root-cause-workspace { grid-template-columns: 1fr; height: auto; }
  .api-list { max-height: 360px; }
  .root-cause-list { max-height: 360px; }
  .metric-grid, .payload-grid { grid-template-columns: 1fr; }
  .detail-heading { flex-direction: column; }
  .trace-workspace { grid-template-columns: 1fr; grid-template-rows: minmax(280px, 42%) minmax(360px, 1fr); }
}
</style>
