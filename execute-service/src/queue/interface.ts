// ── 队列任务 ──

import type { KafkaConfig, LoginMethodPayload } from '../models/test-case.js';

export interface QueueTask {
  executionId: string;
  caseId: string;        // 用例 ID（来自 API 请求的 id 字段）
  name: string;
  yamlScript: string;
  nlp: string;
  timeout: number;
  headless: boolean;
  cacheContent?: string;
  reportFileName: string;
  executionMode?: 'NLP' | 'YAML';
  trafficTaggingEnabled?: boolean;
  kafkaConfig?: KafkaConfig;
  loginMethod?: LoginMethodPayload;
  targetUrl?: string;
}

// ── 队列接口 ──

export interface IQueue {
  enqueue(task: QueueTask): Promise<void>;
  dequeue(): Promise<QueueTask | null>;
  remove(executionId: string): Promise<boolean>;
  getPosition(executionId: string): Promise<number>;
  getQueueLength(): Promise<number>;
  onTask(handler: (task: QueueTask) => Promise<void>): void;
}
