import type { StepResult, ExecutionResult } from './execution.js';

// ── 当前步骤信息 ──

export interface CurrentStep {
  index: number;
  total: number;
  type: string;
  description: string;
}

// ── 进度事件协议（WS/SSE 共用） ──

export type ProgressEvent =
  | { type: 'queued'; executionId: string; position: number }
  | { type: 'started'; executionId: string; timestamp: number }
  | { type: 'step_start'; executionId: string; step: CurrentStep }
  | { type: 'step_progress'; executionId: string; subTask: string }
  | { type: 'step_complete'; executionId: string; step: CurrentStep; result: StepResult }
  | { type: 'completed'; executionId: string; reportUrl: string; duration: number; result: ExecutionResult }
  | { type: 'failed'; executionId: string; error: string; reportUrl?: string }
  | { type: 'cancelled'; executionId: string; message: string }
  | { type: 'heartbeat'; executionId: string; timestamp: number };
