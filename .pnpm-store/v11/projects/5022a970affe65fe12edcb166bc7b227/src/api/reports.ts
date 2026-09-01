import request from './axios'
import type { PageResult, Report } from '@/types'

export interface ApiExchange {
  id?: number; reportId?: number; requestId: string; executionId: string; traceId: string; method: string; url: string;
  segmentId?: string; resourceType?: string; statusCode?: number; durationMs?: number; contentType?: string;
  requestHeaders?: string; requestBodyBase64?: string; requestBodyTruncated?: boolean;
  responseHeaders?: string; responseBodyBase64?: string; responseBodyTruncated?: boolean;
  errorMessage?: string; startedAt?: string; completedAt?: string; createdAt?: string;
}

export interface TraceTopologyNode {
  id: string
  name: string
  type: 'api' | 'service' | 'database' | 'redis' | 'mq' | 'dependency'
  service?: string
  endpoint?: string
  peer?: string
  durationMs?: number
  error?: boolean
  errorMessage?: string
}

export interface TraceTopologyEdge {
  source: string
  target: string
  type: string
  operation?: string
  durationMs?: number
  error?: boolean
  errorMessage?: string
}

export interface TraceSpanSummary {
  spanKey: string
  parentSpanKey?: string
  service?: string
  endpoint?: string
  type?: string
  layer?: string
  component?: string
  peer?: string
  httpUrl?: string
  sql?: string
  tags?: Record<string, string>
  startTime?: number
  endTime?: number
  durationMs?: number
  error?: boolean
  errorMessage?: string
}

export interface TraceTopology {
  traceId?: string
  errorMessage?: string
  nodes: TraceTopologyNode[]
  edges: TraceTopologyEdge[]
  spans: TraceSpanSummary[]
}

export interface TraceLogEntry {
  service?: string
  level?: string
  content?: string
  traceId?: string
  timestamp?: number
}

export interface TraceLogResponse {
  traceId?: string
  errorMessage?: string
  logs: TraceLogEntry[]
}

export interface RootCauseAnalysis {
  reportId: number
  hasBackendError: boolean
  completed: boolean
  status?: string
  modelName?: string
  reasoning?: string
  analysis?: string
  errorMessage?: string
  updatedAt?: string
  errorExchanges: ApiExchange[]
}

/**
 * 分页查询报告列表
 */
export const getReports = (params: {
  page?: number
  size?: number
  projectId?: string
  directoryId?: string
}) => {
  return request.get<PageResult<Report>>('/platform/reports', { params })
}

/**
 * 获取报告详情
 */
export const getReport = (id: number) => {
  return request.get<Report>(`/platform/reports/${id}`)
}

/**
 * 删除报告
 */
export const deleteReport = (id: number) => {
  return request.delete<{ success: boolean }>(`/platform/reports/${id}`)
}

export const getApiExchanges = (reportId: number) => request.get<ApiExchange[]>(`/platform/reports/id/${encodeURIComponent(reportId)}/api-exchanges`)

export const getTraceTopology = (exchangeId: number) => request.get<TraceTopology>(`/platform/reports/api-exchanges/${exchangeId}/trace-topology`)

export const getTraceLogs = (exchangeId: number) => request.get<TraceLogResponse>(`/platform/reports/api-exchanges/${exchangeId}/trace-logs`)

export const getRootCauseAnalysis = (reportId: number) => request.get<RootCauseAnalysis>(`/platform/reports/${reportId}/root-cause-analysis`)

export const getReportContent = async (reportPath: string) => {
  const response = await fetch(reportPath, { credentials: 'include' })
  if (!response.ok) throw new Error(await response.text() || '报告加载失败')
  return response.text()
}

export const streamRootCauseAnalysis = async (
  reportId: number,
  onChunk: (chunk: string) => void,
  onReasoning?: (chunk: string) => void,
): Promise<string> => {
  const response = await fetch(`/api/platform/reports/${encodeURIComponent(reportId)}/root-cause-analysis/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok || !response.body) throw new Error(await response.text() || '根因分析请求失败')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let complete = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const event of events) {
      const name = event.match(/^event:\s*(.+)$/m)?.[1]
      const data = event.match(/^data:\s*([\s\S]*)$/m)?.[1] || ''
      if (name === 'chunk') onChunk(data)
      else if (name === 'reasoning') onReasoning?.(data)
      else if (name === 'complete') complete = data
      else if (name === 'error') throw new Error(data)
    }
    if (done) break
  }
  return complete
}
