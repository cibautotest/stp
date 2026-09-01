import { ReportMergingTool } from '@midscene/core';
import path from 'node:path';
import { logger } from '../utils/logger.js';
import type { ReportManager } from './manager.js';
import type { ExecutionStore } from '../store/execution-store.js';

export interface MergeRequest {
  executionIds: string[];
  batchName?: string;
}

export interface MergeResult {
  success: boolean;
  mergedReportPath: string | null;
  mergedReportUrl: string | null;
  error?: string;
}

/**
 * 批量报告合并器
 * 使用 Midscene 的 ReportMergingTool 将多个执行报告合并为一个 HTML 文件
 */
export class BatchReportMerger {
  private readonly reportManager: ReportManager;
  private readonly store: ExecutionStore;

  constructor(reportManager: ReportManager, store: ExecutionStore) {
    this.reportManager = reportManager;
    this.store = store;
  }

  /**
   * 合并多个执行报告
   */
  async mergeReports(request: MergeRequest): Promise<MergeResult> {
    const { executionIds, batchName } = request;

    if (!executionIds || executionIds.length === 0) {
      return {
        success: false,
        mergedReportPath: null,
        mergedReportUrl: null,
        error: 'executionIds 不能为空',
      };
    }

    const mergingTool = new ReportMergingTool();
    let appendedCount = 0;

    for (const executionId of executionIds) {
      const reportPath = this.reportManager.getReportPath(executionId);

      if (!reportPath) {
        logger.warn({ executionId }, '报告文件不存在，跳过合并');
        continue;
      }

      // 从内存中获取执行记录信息
      const record = this.store.get(executionId);

      let testStatus: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted' = 'passed';
      let testTitle = executionId;
      let testDescription = '';
      let testDuration = 0;

      if (record) {
        testTitle = record.input.name || executionId;
        testDescription = `执行ID: ${executionId}`;
        testDuration = record.duration ?? 0;

        const status = record.status.toLowerCase();
        if (status === 'failed' || status === 'cancelled') {
          testStatus = 'failed';
        } else if (status === 'completed') {
          testStatus = 'passed';
        } else if (status === 'timedout') {
          testStatus = 'timedOut';
        } else {
          testStatus = 'interrupted';
        }
      }

      mergingTool.append({
        reportFilePath: reportPath,
        reportAttributes: {
          testId: executionId,
          testTitle,
          testDescription,
          testDuration,
          testStatus,
        },
      });

      appendedCount++;
    }

    if (appendedCount === 0) {
      return {
        success: false,
        mergedReportPath: null,
        mergedReportUrl: null,
        error: '没有可合并的报告文件',
      };
    }

    try {
      const fileName = batchName || `batch-${Date.now()}`;
      const mergedPath = mergingTool.mergeReports(fileName, { overwrite: true });

      if (!mergedPath) {
        return {
          success: false,
          mergedReportPath: null,
          mergedReportUrl: null,
          error: '合并报告生成失败',
        };
      }

      // 提取文件名作为标识
      const mergedFileName = path.basename(mergedPath, '.html');
      const mergedUrl = await this.reportManager.uploadReportFile(mergedFileName, mergedPath);

      logger.info(
        { appendedCount, mergedPath, mergedUrl },
        '批量报告合并完成',
      );

      return {
        success: true,
        mergedReportPath: mergedFileName,
        mergedReportUrl: mergedUrl,
      };
    } catch (err: any) {
      logger.error({ err }, '批量报告合并失败');
      return {
        success: false,
        mergedReportPath: null,
        mergedReportUrl: null,
        error: `合并失败: ${err.message}`,
      };
    }
  }
}
