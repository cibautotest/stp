import { z } from 'zod';

export const executeSyncSchema = z.object({
  id: z.string().min(1, 'id 不能为空'),
  name: z.string().min(1, 'name 不能为空'),
  yamlScript: z.string().optional(),
  timeout: z.number().int().min(1000, 'timeout 最小 1000ms（1秒）').optional(),
  headless: z.boolean().optional(),
  cacheContent: z.string().optional(),
  nlp: z.string().min(1, 'nlp instruction must not be empty'),
  executionMode: z.enum(['NLP', 'YAML']).optional(),
  trafficTaggingEnabled: z.boolean().optional(),
  kafkaConfig: z.object({
    enabled: z.boolean().optional(),
    brokers: z.string().optional(),
    topic: z.string().optional(),
    clientId: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
  }).optional(),
});

export const executeAsyncSchema = executeSyncSchema.omit({ yamlScript: true }).extend({
  nlp: z.string().min(1, 'nlp instruction must not be empty'),
  yamlScript: z.string().optional(),
});

export const cancelSchema = z.object({
  executionId: z.string().min(1),
});

export const statusParamsSchema = z.object({
  executionId: z.string().min(1),
});

export type ExecuteSyncInput = z.infer<typeof executeSyncSchema>;
export type ExecuteAsyncInput = z.infer<typeof executeAsyncSchema>;
