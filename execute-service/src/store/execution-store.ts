import type { ExecutionRecord } from '../models/execution.js';
import { logger } from '../utils/logger.js';

export class ExecutionStore {
  private records = new Map<string, ExecutionRecord>();

  save(record: ExecutionRecord): void {
    this.records.set(record.executionId, { ...record });
  }

  get(executionId: string): ExecutionRecord | undefined {
    const record = this.records.get(executionId);
    return record ? { ...record } : undefined;
  }

  update(executionId: string, patch: Partial<ExecutionRecord>): void {
    const record = this.records.get(executionId);
    if (record) {
      Object.assign(record, patch);
    }
  }

  delete(executionId: string): boolean {
    return this.records.delete(executionId);
  }

  list(filter?: { status?: string }): ExecutionRecord[] {
    const records = [...this.records.values()];
    if (filter?.status) {
      return records.filter(r => r.status === filter.status);
    }
    return records;
  }

  countByStatus(status: string): number {
    let count = 0;
    for (const r of this.records.values()) {
      if (r.status === status) count++;
    }
    return count;
  }
}
