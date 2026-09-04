import { z } from 'zod';

export const loginMethodSchema = z.object({
  id: z.string().min(1, 'loginMethod.id 不能为空'),
  type: z.enum(['none', 'cas', 'local']),
  loginUrl: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  stepsNlp: z.string().nullish(),
  yamlScript: z.string().nullish(),
});

/** 递归将对象中的 null 转为 undefined（Jackson 默认序列化 null 字段，与 TestCaseInput 的 optional 类型对齐） */
export function nullsToUndefined(value: unknown): any {
  if (Array.isArray(value)) return value.map(nullsToUndefined);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, v === null ? undefined : nullsToUndefined(v)])
    );
  }
  return value === null ? undefined : value;
}

export const executeSyncSchema = z.object({
  id: z.string().min(1, 'id 不能为空'),
  name: z.string().min(1, 'name 不能为空'),
  yamlScript: z.string().nullish(),
  timeout: z.number().int().min(1000, 'timeout 最小 1000ms（1秒）').nullish(),
  headless: z.boolean().nullish(),
  cacheContent: z.string().nullish(),
  nlp: z.string().min(1, 'nlp instruction must not be empty'),
  executionMode: z.enum(['NLP', 'YAML']).optional(),
  trafficTaggingEnabled: z.boolean().nullish(),
  kafkaConfig: z.object({
    enabled: z.boolean().optional(),
    brokers: z.string().optional(),
    topic: z.string().optional(),
    clientId: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).nullish(),
  loginMethod: loginMethodSchema.nullish(),
  targetUrl: z.string().nullish(),
});

export const executeAsyncSchema = executeSyncSchema.omit({ yamlScript: true }).extend({
  nlp: z.string().min(1, 'nlp instruction must not be empty'),
  yamlScript: z.string().nullish(),
});

export const cancelSchema = z.object({
  executionId: z.string().min(1),
});

export const statusParamsSchema = z.object({
  executionId: z.string().min(1),
});

export type ExecuteSyncInput = z.infer<typeof executeSyncSchema>;
export type ExecuteAsyncInput = z.infer<typeof executeAsyncSchema>;
