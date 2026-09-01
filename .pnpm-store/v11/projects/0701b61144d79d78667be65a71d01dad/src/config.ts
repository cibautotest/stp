import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  QUEUE_TYPE: z.enum(['memory', 'redis']).default('memory'),
  QUEUE_MAX_SIZE: z.coerce.number().default(100),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  WORKER_CONCURRENCY: z.coerce.number().default(3),
  EXECUTION_TIMEOUT_MS: z.coerce.number().default(120_000),
  SYNC_TIMEOUT_MS: z.coerce.number().default(60_000),
  BROWSER_HEADLESS: z.string().transform(v => v !== 'false').default('true'),

  REPORT_DIR: z.string().default('./midscene_run/report'),
  REPORT_MAX_AGE_DAYS: z.coerce.number().default(90),
  // Platform receives the generated HTML and becomes the only report reader.
  PLATFORM_REPORT_UPLOAD_URL: z.string().default('http://localhost:8081/api/platform/internal/reports'),
  PLATFORM_REPORT_PUBLIC_BASE_URL: z.string().default('http://localhost:8081/api/platform/reports/content'),
  PLATFORM_CALLBACK_URL: z.string().default('http://localhost:8081/api/platform/callback/execution-result'),
  REPORT_UPLOAD_TOKEN: z.string().min(32),
  REPORT_CLEANUP_CRON: z.string().default('0 2 * * *'),
  OBSERVABILITY_ENABLED: z.string().transform(v => v === 'true').default('false'),
  OBSERVABILITY_API_HOSTS: z.string().default(''),
  OBSERVABILITY_KAFKA_ENABLED: z.string().transform(v => v === 'true').default('false'),
  KAFKA_BOOTSTRAP_SERVERS: z.string().default(''),
  KAFKA_TOPIC: z.string().default('ui-test-api-exchange.v1'),
  KAFKA_CLIENT_ID: z.string().default('smart-testing-execute'),
  KAFKA_USERNAME: z.string().default(''),
  KAFKA_PASSWORD: z.string().default(''),
  SW8_SERVICE_NAME: z.string().default('ui-test-executor'),
  SW8_SERVICE_INSTANCE: z.string().default('execute-service'),
  API_EXCHANGE_MAX_BODY_BYTES: z.coerce.number().default(10 * 1024 * 1024),
});

export type AppConfig = z.infer<typeof envSchema>;

let _config: AppConfig;

export function getConfig(): AppConfig {
  if (!_config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('❌ 环境变量配置错误:', result.error.format());
      process.exit(1);
    }
    _config = result.data;
  }
  return _config;
}
