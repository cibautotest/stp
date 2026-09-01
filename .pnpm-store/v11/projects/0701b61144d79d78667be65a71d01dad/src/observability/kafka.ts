import { Kafka, type Producer } from 'kafkajs';
import { logger } from '../utils/logger.js';
import type { KafkaConfig } from '../models/test-case.js';
import { getConfig } from '../config.js';

export interface ApiExchangeEvent {
  eventVersion: 1;
  requestId: string;
  executionId: string;
  caseId: string;
  traceId: string;
  segmentId: string;
  request: { method: string; url: string; resourceType?: string; startedAt: string; headers: Record<string, string>; bodyBase64?: string; bodyTruncated?: boolean };
  response?: { status?: number; durationMs: number; contentType?: string; size?: number; headers: Record<string, string>; bodyBase64?: string; bodyTruncated?: boolean };
  error?: string;
  completedAt: string;
}

export class ApiExchangeProducer {
  private producer?: Producer;
  private enabled = false;
  private readonly config: Required<Pick<KafkaConfig, 'enabled' | 'brokers' | 'topic' | 'clientId'>> & Pick<KafkaConfig, 'username' | 'password'>;

  constructor(config?: KafkaConfig) {
    this.config = ApiExchangeProducer.resolveConfig(config);
  }

  static async create(config?: KafkaConfig): Promise<ApiExchangeProducer | undefined> {
    const resolved = ApiExchangeProducer.resolveConfig(config);
    if (!resolved.enabled) {
      logger.info({ source: config ? 'task' : 'env' }, 'API exchange Kafka producer disabled');
      return undefined;
    }
    const producer = new ApiExchangeProducer(config);
    await producer.start();
    return producer;
  }

  private static resolveConfig(config?: KafkaConfig): Required<Pick<KafkaConfig, 'enabled' | 'brokers' | 'topic' | 'clientId'>> & Pick<KafkaConfig, 'username' | 'password'> {
    const appConfig = getConfig();
    return {
      enabled: config?.enabled ?? appConfig.OBSERVABILITY_KAFKA_ENABLED,
      brokers: config?.brokers || appConfig.KAFKA_BOOTSTRAP_SERVERS,
      topic: config?.topic || appConfig.KAFKA_TOPIC,
      clientId: config?.clientId || appConfig.KAFKA_CLIENT_ID,
      username: config?.username || appConfig.KAFKA_USERNAME || undefined,
      password: config?.password || appConfig.KAFKA_PASSWORD || undefined,
    };
  }

  async start(): Promise<void> {
    this.enabled = Boolean(this.config.enabled && this.config.brokers);
    if (!this.enabled) {
      if (this.config.enabled) logger.warn('Kafka is enabled but no brokers configured; API exchanges will not be persisted');
      return;
    }

    logger.info({
      brokers: this.config.brokers,
      topic: this.config.topic,
      clientId: this.config.clientId,
      sasl: Boolean(this.config.username),
    }, 'Starting API exchange Kafka producer');

    const kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers.split(',').map(value => value.trim()).filter(Boolean),
      ...(this.config.username
        ? { sasl: { mechanism: 'plain' as const, username: this.config.username, password: this.config.password || '' } }
        : {}),
    });

    this.producer = kafka.producer();
    await this.producer.connect();
    logger.info({ topic: this.config.topic, clientId: this.config.clientId }, 'API exchange Kafka producer connected');
  }

  async publish(event: ApiExchangeEvent): Promise<void> {
    if (!this.enabled || !this.producer) return;

    try {
      await this.producer.send({
        topic: this.config.topic,
        messages: [{ key: `${event.executionId}:${event.requestId}`, value: JSON.stringify(event) }],
      });
      logger.debug({ executionId: event.executionId, requestId: event.requestId, topic: this.config.topic }, 'API exchange Kafka publish succeeded');
    } catch (err) {
      logger.warn({ err, requestId: event.requestId }, 'API exchange Kafka publish failed');
    }
  }

  async stop(): Promise<void> {
    if (this.producer) await this.producer.disconnect();
  }
}
