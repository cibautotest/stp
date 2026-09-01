import { createLogger } from '../utils/logger.js';

const log = createLogger('CancelManager');

export class CancelManager {
  private controllers = new Map<string, AbortController>();

  register(executionId: string, controller: AbortController): void {
    this.controllers.set(executionId, controller);
    log.debug({ executionId }, '取消控制器已注册');
  }

  cancel(executionId: string): boolean {
    const ctrl = this.controllers.get(executionId);
    if (!ctrl) return false;
    ctrl.abort();
    this.controllers.delete(executionId);
    log.info({ executionId }, '执行任务已取消');
    return true;
  }

  remove(executionId: string): void {
    this.controllers.delete(executionId);
    log.debug({ executionId }, '取消控制器已移除');
  }

  isCancelled(executionId: string): boolean {
    const ctrl = this.controllers.get(executionId);
    return ctrl ? ctrl.signal.aborted : false;
  }
}
