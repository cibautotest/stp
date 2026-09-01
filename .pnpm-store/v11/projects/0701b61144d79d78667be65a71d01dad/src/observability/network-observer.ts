import { randomUUID } from 'node:crypto';
import type { BrowserContext, Request, Response } from 'playwright';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';
import { buildSw8, generateSkywalkingId } from './sw8.js';
import type { ApiExchangeProducer, ApiExchangeEvent } from './kafka.js';

type Pending = Omit<ApiExchangeEvent, 'response' | 'error' | 'completedAt'> & { startedAtMs: number };

export class NetworkObserver {
  private pending = new WeakMap<Request, Pending>();
  private publishing = new Set<Promise<void>>();
  private hosts = new Set(getConfig().OBSERVABILITY_API_HOSTS.split(',').map(v => v.trim().toLowerCase()).filter(Boolean));

  constructor(
    private executionId: string,
    private caseId: string,
    private producer: ApiExchangeProducer | undefined,
    private trafficTaggingEnabled = false,
  ) {}

  async install(context: BrowserContext): Promise<void> {
    const observabilityEnabled = getConfig().OBSERVABILITY_ENABLED;
    const kafkaEnabled = Boolean(this.producer);

    if (!observabilityEnabled && !this.trafficTaggingEnabled && !kafkaEnabled) {
      logger.info({ executionId: this.executionId, trafficTaggingEnabled: this.trafficTaggingEnabled, observabilityEnabled, kafkaEnabled }, 'Network observer skipped');
      return;
    }

    logger.info({
      executionId: this.executionId,
      caseId: this.caseId,
      trafficTaggingEnabled: this.trafficTaggingEnabled,
      observabilityEnabled,
      kafkaEnabled,
      apiHosts: [...this.hosts],
    }, 'Network observer enabled');

    await context.route('**/*', async route => {
      const request = route.request();
      if (!this.isBusiness(request)) return route.continue();

      const target = new URL(request.url());
      const requestId = randomUUID();
      const traceId = generateSkywalkingId();
      const segmentId = generateSkywalkingId();
      const injectedHeaders = {
        ...request.headers(),
        ...(this.trafficTaggingEnabled ? {
          sw8: buildSw8(
            traceId,
            segmentId,
            getConfig().SW8_SERVICE_NAME,
            getConfig().SW8_SERVICE_INSTANCE,
            `ui-test/${this.caseId}`,
            target.port ? `${target.hostname}:${target.port}` : target.hostname,
            0,
          ),
          'x-test-execution-id': this.executionId,
          'x-test-request-id': requestId,
        } : {}),
      };

      if (this.trafficTaggingEnabled) {
        logger.debug({ executionId: this.executionId, requestId, url: request.url(), sw8: injectedHeaders.sw8 }, 'Injected SkyWalking traffic headers');
      }

      const body = request.postDataBuffer();
      this.pending.set(request, {
        eventVersion: 1,
        requestId,
        executionId: this.executionId,
        caseId: this.caseId,
        traceId,
        segmentId,
        request: {
          method: request.method(),
          url: request.url(),
          resourceType: request.resourceType(),
          startedAt: new Date().toISOString(),
          headers: injectedHeaders,
          ...this.encodeBody(body),
        },
        startedAtMs: Date.now(),
      });

      logger.debug({ executionId: this.executionId, requestId, method: request.method(), url: request.url(), trafficTaggingEnabled: this.trafficTaggingEnabled, kafkaEnabled }, 'Observed browser API request');
      await route.continue({ headers: injectedHeaders });
    });

    context.on('response', response => this.track(this.response(response)));
    context.on('requestfailed', request => this.track(this.failed(request, request.failure()?.errorText || 'request failed')));
  }

  private isBusiness(request: Request): boolean {
    try {
      return ['fetch', 'xhr'].includes(request.resourceType()) && (this.hosts.size === 0 || this.hosts.has(new URL(request.url()).host.toLowerCase()));
    } catch {
      return false;
    }
  }

  private async response(response: Response): Promise<void> {
    const event = this.pending.get(response.request());
    if (!event) return;
    this.pending.delete(response.request());
    if (!this.producer) return;

    const h = await response.allHeaders();
    let body: Buffer | undefined;
    try {
      body = await response.body();
    } catch {
      // redirect/closed response
    }

    logger.debug({ executionId: this.executionId, requestId: event.requestId, status: response.status(), url: event.request.url }, 'Publishing API exchange to Kafka');
    await this.producer.publish({
      ...event,
      response: {
        status: response.status(),
        durationMs: Date.now() - event.startedAtMs,
        contentType: h['content-type'],
        size: Number(h['content-length']) || body?.length,
        headers: h,
        ...this.encodeBody(body),
      },
      completedAt: new Date().toISOString(),
    });
  }

  private async failed(request: Request, error: string): Promise<void> {
    const event = this.pending.get(request);
    if (!event) return;
    this.pending.delete(request);
    if (!this.producer) return;

    logger.debug({ executionId: this.executionId, requestId: event.requestId, error, url: event.request.url }, 'Publishing failed API exchange to Kafka');
    await this.producer.publish({ ...event, error, completedAt: new Date().toISOString() });
  }

  async flush(): Promise<void> {
    await Promise.allSettled([...this.publishing]);
  }

  private track(promise: Promise<void>): void {
    this.publishing.add(promise);
    promise.finally(() => this.publishing.delete(promise)).catch(() => {});
  }

  private encodeBody(body?: Buffer | null): { bodyBase64?: string; bodyTruncated?: boolean } {
    if (!body?.length) return {};
    const max = getConfig().API_EXCHANGE_MAX_BODY_BYTES;
    return { bodyBase64: body.subarray(0, max).toString('base64'), bodyTruncated: body.length > max || undefined };
  }
}
