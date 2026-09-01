import type { TestCaseInput } from './test-case.js';

// ── 执行状态枚举 ──

export type ExecutionStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StepStatus = 'passed' | 'failed' | 'skipped';

// ── 步骤结果 ──

export interface StepResult {
  index: number;
  type: string;
  status: StepStatus;
  duration: number;
  error?: string;
  screenshot?: string;
  data?: Record<string, unknown>;
}

// ── 任务结果 ──

export interface TaskResult {
  name: string;
  status: StepStatus;
  steps: StepResult[];
}

// ── 执行结果 ──

export interface ExecutionResult {
  executionId: string;
  status: 'completed' | 'failed';
  tasks: TaskResult[];
  reportUrl: string | null;
}

// ── 执行记录（存储用） ──

export interface ExecutionRecord {
  executionId: string;
  input: Pick<TestCaseInput, 'id' | 'name'>;
  yamlScript: string;
  status: ExecutionStatus;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  reportUrl: string | null;
  error: string | null;
  result: ExecutionResult | null;
  queuePosition: number;
}
