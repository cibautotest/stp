import cron from 'node-cron';
import type { ReportManager } from './manager.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export function startCleanupJob(reportManager: ReportManager): void {
  const cronExpr = getConfig().REPORT_CLEANUP_CRON;
  const maxAgeDays = getConfig().REPORT_MAX_AGE_DAYS;

  cron.schedule(cronExpr, () => {
    logger.info('开始执行报告清理任务');
    const cleaned = reportManager.cleanupExpired();
    logger.info({ cleaned, maxAgeDays }, '报告清理任务完成');
  });

  logger.info({ cron: cronExpr, maxAgeDays }, '报告清理定时任务已注册');
}
