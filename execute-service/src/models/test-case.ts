// ── 用例输入（API 请求体） ──

export interface TestCaseInput {
  id: string;
  name: string;
  yamlScript?: string;
  nlp: string;
  timeout?: number;
  headless?: boolean;
  cacheContent?: string;
  executionMode?: 'NLP' | 'YAML';
  trafficTaggingEnabled?: boolean;
  kafkaConfig?: KafkaConfig;
}

export interface KafkaConfig {
  enabled?: boolean;
  brokers?: string;
  topic?: string;
  clientId?: string;
  username?: string;
  password?: string;
}

// ── 原始 YAML 解析后的结构（Midscene 标准格式） ──

/** agent 配置段（对应 YAML 中的 agent: 节点） */
export interface YamlAgentConfig {
  testId?: string;
  groupName?: string;
  groupDescription?: string;
  generateReport?: boolean;
  autoPrintReportMsg?: boolean;
  reportFileName?: string;
  replanningCycleLimit?: number;
  aiActContext?: string;
  cache?: {
    strategy: string;
    id: string;
  };
}

/** web 配置段（对应 YAML 中的 web: 节点） */
export interface YamlWebConfig {
  url: string;
  serve?: string;
  userAgent?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  deviceScaleFactor?: number;
  cookie?: string;
  waitForNetworkIdle?: {
    timeout: number;
    continueOnNetworkIdleError: boolean;
  };
  output?: string;
  forceSameTabNavigation?: boolean;
}

/** 完整的 YAML 文档结构 */
export interface YamlDoc {
  agent?: YamlAgentConfig;
  web?: YamlWebConfig;
  tasks: Array<{
    name?: string;
    continueOnError?: boolean;
    flow: Array<Record<string, unknown>>;
  }>;
}
