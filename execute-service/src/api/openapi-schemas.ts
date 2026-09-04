/**
 * 公共错误响应 Schema（用于各端点复用）
 */
export const errorResponse400 = {
  type: 'object',
  description: '请求参数校验失败',
  properties: {
    error: { type: 'string', example: 'VALIDATION_ERROR' },
    message: { type: 'string' },
    details: { type: 'object' },
  },
};

export const errorResponse404 = {
  type: 'object',
  description: '资源不存在',
  properties: {
    error: { type: 'string', example: 'NOT_FOUND' },
    message: { type: 'string' },
  },
};

export const errorResponse500 = {
  type: 'object',
  description: '服务器内部错误',
  properties: {
    error: { type: 'string', example: 'INTERNAL_ERROR' },
    message: { type: 'string' },
  },
};

// ── 各端点请求/响应 JSON Schema（手动构建，确保 Fastify ajv draft-07 兼容）──

/** POST /execute/sync 与 /execute/async 共用请求体 */
export const executeSyncBodySchema = {
  type: 'object',
  required: ['id', 'name', 'nlp'],
  properties: {
    id: { type: 'string', minLength: 1, description: '用例唯一标识' },
    name: { type: 'string', minLength: 1, description: '用例名称' },
    yamlScript: { type: 'string', nullable: true, description: 'optional YAML script' },
    nlp: { type: 'string', minLength: 1, description: 'natural language instruction' },
    trafficTaggingEnabled: { type: 'boolean', nullable: true, description: 'whether to inject traffic tagging headers' },
    kafkaConfig: {
      type: 'object',
      nullable: true,
      description: 'Kafka config supplied by platform project settings',
      properties: {
        enabled: { type: 'boolean' },
        brokers: { type: 'string' },
        topic: { type: 'string' },
        clientId: { type: 'string' },
        username: { type: 'string' },
        password: { type: 'string' },
      },
      additionalProperties: false,
    },
    executionMode: { type: 'string', enum: ['NLP', 'YAML'], description: 'execution mode' },
    timeout: { type: 'integer', minimum: 1, nullable: true, description: '超时时间(ms)，默认 60000' },
    headless: { type: 'boolean', nullable: true, description: '是否无头模式，默认 true' },
    cacheContent: { type: 'string', nullable: true, description: 'Midscene UI cache content supplied by platform' },
    targetUrl: { type: 'string', nullable: true, description: 'NLP 模式目标页面 URL（执行步骤前先导航）' },
    loginMethod: {
      type: 'object',
      nullable: true,
      description: '登录方式负载（type != none 时先执行登录阶段，独立缓存）',
      properties: {
        id: { type: 'string', minLength: 1, description: '登录方式 ID（缓存 ID 后缀）' },
        type: { type: 'string', enum: ['none', 'cas', 'local'], description: '登录类型' },
        loginUrl: { type: 'string', description: '登录页地址' },
        username: { type: 'string', description: '账号' },
        password: { type: 'string', description: '密码' },
        stepsNlp: { type: 'string', description: '登录补充步骤 NLP' },
        yamlScript: { type: 'string', description: '预生成的登录 YAML' },
      },
      required: ['id', 'type'],
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

/** POST /execute/sync 成功响应 */
export const executeSyncResponse200 = {
  type: 'object',
  description: '执行成功（同步返回完整结果）',
  properties: {
    executionId: { type: 'string', format: 'uuid', description: '执行ID' },
    status: { type: 'string', enum: ['completed', 'failed'], description: '执行状态' },
    tasks: {
      type: 'array',
      description: '任务列表',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '任务名称' },
          status: { type: 'string', enum: ['passed', 'failed', 'skipped'], description: '任务状态' },
          steps: {
            type: 'array',
            description: '步骤列表',
            items: {
              type: 'object',
              properties: {
                index: { type: 'integer', description: '步骤序号' },
                type: { type: 'string', description: '步骤类型 (ai/aiAction/aiAssert/aiQuery/aiWaitFor/sleep)' },
                status: { type: 'string', enum: ['passed', 'failed', 'skipped'], description: '步骤状态' },
                duration: { type: 'integer', description: '步骤耗时(ms)' },
                error: { type: 'string', description: '错误信息（如有）' },
                screenshot: { type: 'string', description: '截图 Base64（如有）' },
                data: { type: 'object', description: '附加数据（如有）' },
              },
            },
          },
        },
      },
    },
    reportUrl: { type: 'string', nullable: true, description: '报告访问 URL' },
  },
};

/** POST /execute/async 成功响应 */
export const executeAsyncResponse202 = {
  type: 'object',
  description: '任务已入队（异步模式）',
  properties: {
    executionId: { type: 'string', format: 'uuid', description: '执行ID' },
    status: { type: 'string', enum: ['queued'], description: '入队状态' },
  },
};

/** GET /execute/:executionId/status 路径参数 */
export const statusParamsJsonSchema = {
  type: 'object',
  required: ['executionId'],
  properties: {
    executionId: { type: 'string', minLength: 1, description: '执行ID' },
  },
  additionalProperties: false,
};

/** GET /execute/:executionId/status 响应 */
export const statusResponse200 = {
  type: 'object',
  description: '执行状态信息',
  properties: {
    executionId: { type: 'string', description: '执行ID' },
    status: {
      type: 'string',
      enum: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled'],
      description: '执行状态',
    },
    progress: { type: 'integer', minimum: 0, maximum: 100, description: '进度百分比' },
    startedAt: { type: 'string', nullable: true, description: '开始时间 (ISO 8601)' },
    completedAt: { type: 'string', nullable: true, description: '完成时间 (ISO 8601)' },
    duration: { type: 'integer', nullable: true, description: '耗时(ms)' },
    reportUrl: { type: 'string', nullable: true, description: '报告访问 URL' },
    error: { type: 'string', nullable: true, description: '错误信息' },
    queuePosition: { type: 'integer', description: '队列位置（-1 表示不在队列中）' },
  },
};

/** POST /execute/:executionId/cancel 路径参数 */
export const cancelParamsJsonSchema = {
  type: 'object',
  required: ['executionId'],
  properties: {
    executionId: { type: 'string', minLength: 1, description: '执行ID' },
  },
  additionalProperties: false,
};

/** POST /execute/:executionId/cancel 响应 */
export const cancelResponse200 = {
  type: 'object',
  description: '取消操作结果',
  properties: {
    success: { type: 'boolean', description: '是否成功' },
    message: { type: 'string', description: '结果说明' },
  },
};

/** POST /execute/:executionId/cancel 失败响应 */
export const cancelResponse400 = {
  type: 'object',
  description: '取消失败',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
  },
};

/** GET /health 响应 */
export const healthResponse200 = {
  type: 'object',
  description: '服务健康状态',
  properties: {
    status: { type: 'string', enum: ['ok'], description: '服务状态' },
    timestamp: { type: 'string', format: 'date-time', description: '当前时间' },
    uptime: { type: 'number', description: '运行时长(秒)' },
  },
};

/** WebSocket 进度事件类型（文档用途） */
export const wsProgressEvent = {
  type: 'object',
  description: '进度事件（通过 WebSocket/SSE 推送）',
  properties: {
    type: {
      type: 'string',
      enum: ['queued', 'started', 'step_start', 'step_progress', 'step_complete', 'completed', 'failed', 'cancelled', 'heartbeat'],
      description: '事件类型',
    },
    executionId: { type: 'string', description: '执行ID' },
  },
};
