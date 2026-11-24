package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import com.smarttesting.platform.mapper.ReportMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 执行报告幂等写入服务
 * 回调路径与定时同步路径共用，按 executionId 去重，防止一次执行生成两份报告
 */
@Service
public class ExecutionReportService {

    private static final Logger log = LoggerFactory.getLogger(ExecutionReportService.class);

    @Resource
    private ReportMapper reportMapper;

    @Resource
    private ApiExchangeMapper apiExchangeMapper;

    /**
     * 按 executionId 幂等写入 SINGLE 报告：
     * 已存在同 executionId 的报告则原位更新（保留原 id 与 createdAt），否则插入新报告；
     * 并统一将 api_exchange 接口记录关联到该报告
     */
    public Report upsertSingleReport(Report report, String executionId) {
        String normalizedExecutionId = executionId != null && !executionId.isBlank() ? executionId : null;

        if (normalizedExecutionId != null) {
            List<Report> existing = reportMapper.selectList(new QueryWrapper<Report>()
                    .eq("execution_id", normalizedExecutionId)
                    .orderByDesc("id")
                    .last("LIMIT 1"));
            if (!existing.isEmpty()) {
                Report old = existing.get(0);
                report.setId(old.getId());
                report.setCreatedAt(old.getCreatedAt());
                report.setExecutionId(normalizedExecutionId);
                reportMapper.updateById(report);
                apiExchangeMapper.updateReportIdByExecutionId(normalizedExecutionId, old.getId());
                log.info("Report updated in place for executionId={}, reportId={}", normalizedExecutionId, old.getId());
                return report;
            }
        }

        report.setExecutionId(normalizedExecutionId);
        if (report.getCreatedAt() == null) {
            report.setCreatedAt(LocalDateTime.now());
        }
        reportMapper.insert(report);
        if (normalizedExecutionId != null) {
            apiExchangeMapper.updateReportIdByExecutionId(normalizedExecutionId, report.getId());
        }
        log.info("Report inserted for executionId={}, reportId={}", normalizedExecutionId, report.getId());
        return report;
    }
}
