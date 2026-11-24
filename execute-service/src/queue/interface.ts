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
  executionMode?: 'NLP' | 'YAML' | 'CODE';
  /** CODE 模式：录制脚本内容 */
  script?: string;
  /** CODE 模式步骤截图模式：ERROR=仅失败/AI兜底步骤（默认），ALL=全步骤截图 */
  screenshotMode?: 'ERROR' | 'ALL';
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
