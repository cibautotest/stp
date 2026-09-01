import { randomBytes } from 'node:crypto';

/** SkyWalking IDs are opaque strings; 128-bit hex values are compatible with
 * the official agents and avoid collisions between concurrent executions. */
export function generateSkywalkingId(): string {
  return randomBytes(16).toString('hex');
}

function b64(value: string): string {
  // SkyWalking uses Base64 values without trailing padding in sw8 propagation.
  return Buffer.from(value, 'utf8').toString('base64').replace(/=+$/, '');
}

export function buildSw8(traceId: string, segmentId: string, service: string, instance: string, endpoint: string, peer: string, spanId = 0): string {
  // sw8 = sampled-traceId-segmentId-spanId-service-serviceInstance-endpoint-peer
  return [1, b64(traceId), b64(segmentId), spanId, b64(service), b64(instance), b64(endpoint), b64(peer)].join('-');
}
