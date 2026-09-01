import path from 'node:path';
import fs from 'node:fs';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

export class ReportManager {
  private readonly baseDir: string;
  private readonly maxAgeDays: number;
  private readonly uploadUrl: string;
  private readonly publicBaseUrl: string;
  private readonly uploadToken: string;

  constructor() {
    const config = getConfig();
    this.baseDir = path.resolve(config.REPORT_DIR);
    this.maxAgeDays = config.REPORT_MAX_AGE_DAYS;
    this.uploadUrl = config.PLATFORM_REPORT_UPLOAD_URL.replace(/\/+$/, '');
    this.publicBaseUrl = config.PLATFORM_REPORT_PUBLIC_BASE_URL.replace(/\/+$/, '');
    this.uploadToken = config.REPORT_UPLOAD_TOKEN;

    // 确保报告目录存在
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /** Upload a completed report to the platform and return its platform URL. */
  async uploadReport(executionId: string, reportFileName = executionId): Promise<string | null> {
    const reportPath = this.getReportPath(reportFileName);
    if (!reportPath) return null;

    return this.uploadReportFile(executionId, reportPath);
  }

  /** Upload an arbitrary generated HTML report (used by batch report merging). */
  async uploadReportFile(reportId: string, reportPath: string): Promise<string> {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(reportId)) {
      throw new Error('非法报告标识');
    }

    const response = await fetch(`${this.uploadUrl}/${encodeURIComponent(reportId)}`, {
      method: 'PUT',
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-report-upload-token': this.uploadToken,
      },
      body: fs.readFileSync(reportPath),
    });
    if (!response.ok) {
      throw new Error(`报告上传至平台失败: HTTP ${response.status}`);
    }

    const payload = await response.json() as { reportUrl?: string };
    const reportUrl = payload.reportUrl || `${this.publicBaseUrl}/${encodeURIComponent(reportId)}`;
    logger.info({ reportId, reportUrl }, '报告已上传至平台服务');
    return reportUrl;
  }

  /**
   * 检查报告是否存在
   */
  reportExists(reportFileName: string): boolean {
    const reportFile = path.join(this.baseDir, `${reportFileName}.html`);
    return fs.existsSync(reportFile);
  }

  /**
   * 获取报告文件路径
   */
  getReportPath(reportFileName: string): string | null {
    const reportFile = path.join(this.baseDir, `${reportFileName}.html`);
    return fs.existsSync(reportFile) ? reportFile : null;
  }

  /**
   * 删除指定执行报告
   */
  deleteReport(executionId: string): void {
    const reportFile = path.join(this.baseDir, `${executionId}.html`);
    if (fs.existsSync(reportFile)) {
      fs.rmSync(reportFile);
      logger.debug({ executionId }, '报告已删除');
    }
  }

  /**
   * 清理过期报告
   */
  cleanupExpired(): number {
    const now = Date.now();
    const maxAge = this.maxAgeDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;

    if (!fs.existsSync(this.baseDir)) return 0;

    const entries = fs.readdirSync(this.baseDir);
    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;

      const filePath = path.join(this.baseDir, entry);
      const stat = fs.statSync(filePath);

      if (now - stat.mtimeMs > maxAge) {
        fs.rmSync(filePath);
        cleaned++;
        logger.debug({ report: entry }, '过期报告已清理');
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned, maxAgeDays: this.maxAgeDays }, '报告清理完成');
    }
    return cleaned;
  }
}
