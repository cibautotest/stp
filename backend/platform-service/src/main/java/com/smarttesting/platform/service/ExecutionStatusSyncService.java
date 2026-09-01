package com.smarttesting.platform.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import com.smarttesting.platform.mapper.ReportMapper;
import com.smarttesting.platform.mapper.TestCaseMapper;
import com.smarttesting.platform.model.ExecuteStatusResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 执行状态同步服务
 * 定时任务轮询 execute-service 状态，同步更新 TestCase 和 Report 表
 */
@Service
public class ExecutionStatusSyncService {

    private static final Logger log = LoggerFactory.getLogger(ExecutionStatusSyncService.class);

    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_RUNNING = "RUNNING";
    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";
    private static final String STATUS_UNKNOWN = "UNKNOWN";

    private static final Set<String> RUNNING_STATUSES = Set.of("pending", "queued", "running");
    private static final DateTimeFormatter REPORT_NAME_TIME_FORMAT = DateTimeFormatter.ofPattern("yyMMddHHmmss");

    @Resource
    private ExecutionRecordMapper executionRecordMapper;

    @Resource
    private TestCaseMapper testCaseMapper;

    @Resource
    private ReportMapper reportMapper;

    @Resource
    private ApiExchangeMapper apiExchangeMapper;

    @Resource
    private ExecuteServiceGateway executeServiceGateway;

    @Resource
    private ObjectMapper objectMapper;

    /**
     * 每 10 秒轮询一次 RUNNING 状态的执行记录
     */
    @Scheduled(fixedRate = 10000)
    @Transactional
    public void syncExecutionStatuses() {
        List<ExecutionRecord> runningRecords = executionRecordMapper.selectRunningRecords();

        if (runningRecords.isEmpty()) {
            return;
        }

        log.info("[ExecutionStatusSync] Polling {} running execution records", runningRecords.size());

        for (ExecutionRecord record : runningRecords) {
            try {
                syncSingleExecution(record);
            } catch (Exception e) {
                log.error("[ExecutionStatusSync] Failed to sync executionId: {}", record.getExecutionId(), e);
            }
        }
    }

    private void syncSingleExecution(ExecutionRecord record) {
        String executionId = record.getExecutionId();

        ExecuteStatusResponse statusResponse = executeServiceGateway.getStatus(record.getExecuteServiceUrl(), executionId);
        String remoteStatus = statusResponse.getStatus();

        log.debug("[ExecutionStatusSync] executionId={}, remoteStatus={}", executionId, remoteStatus);

        // 状态映射
        String mappedStatus = mapRemoteStatus(remoteStatus);

        // 判断是否需要更新
        if (isTerminalStatus(mappedStatus)) {
            // 执行完成或失败
            updateExecutionCompleted(record, statusResponse, mappedStatus);
        } else if (STATUS_RUNNING.equals(mappedStatus)) {
            // 仍在运行，更新记录状态
            record.setStatus(STATUS_RUNNING);
            executionRecordMapper.updateById(record);
        }
    }

    private String mapRemoteStatus(String remoteStatus) {
        if (remoteStatus == null) {
            return STATUS_UNKNOWN;
        }

        String lowerStatus = remoteStatus.toLowerCase();

        if (RUNNING_STATUSES.contains(lowerStatus)) {
            return STATUS_RUNNING;
        }

        switch (lowerStatus) {
            case "completed":
                return STATUS_SUCCESS;
            case "failed":
            case "cancelled":
                return STATUS_FAILED;
            default:
                return STATUS_UNKNOWN;
        }
    }

    private boolean isTerminalStatus(String status) {
        return STATUS_SUCCESS.equals(status) || STATUS_FAILED.equals(status) || STATUS_UNKNOWN.equals(status);
    }

    private void updateExecutionCompleted(ExecutionRecord record, ExecuteStatusResponse response, String mappedStatus) {
        String caseId = record.getCaseId();

        // 1. 更新 ExecutionRecord 状态（含执行耗时）
        record.setStatus(mappedStatus);
        if (response.getDuration() != null) {
            record.setDuration(response.getDuration());
        }
        executionRecordMapper.updateById(record);

        // 2. 查询并更新 TestCase 状态
        TestCase testCase = testCaseMapper.selectById(caseId);
        if (testCase != null) {
            testCase.setStatus(mappedStatus);
            testCase.setExecutedAt(LocalDateTime.now());

            // 更新报告路径
            if (response.getReportUrl() != null && !response.getReportUrl().isBlank()) {
                testCase.setHtmlReportPath(response.getReportUrl());
                testCase.setReportGeneratedAt(LocalDateTime.now());
            }

            testCaseMapper.updateById(testCase);
        }

        // 3. 批量执行：有 batchId 时仅同步状态，不在此处触发合并
        // 合并由 PlanExecutionService（计划路径）或 BatchExecutionService.monitorBatchCompletion（直接批量路径）负责
        if (record.getBatchId() != null && !record.getBatchId().isEmpty()) {
            log.info("[ExecutionStatusSync] Batch execution completed: batchId={}, caseId={}, status={}",
                    record.getBatchId(), caseId, mappedStatus);
            return;
        }

        // 4. 单个执行：创建 SINGLE report（保留原有行为）
        createSingleReport(record, caseId, testCase, response, mappedStatus);
    }

    private void createSingleReport(ExecutionRecord record, String caseId, TestCase testCase, ExecuteStatusResponse response, String mappedStatus) {
        Report report = new Report();
        report.setCaseId(caseId);
        report.setType("SINGLE");
        report.setStatus(mappedStatus);
        report.setDuration(response.getDuration());
        report.setName(reportName(testCase));

        if (testCase != null) {
            report.setProjectId(testCase.getProjectId());
            report.setDirectoryId(testCase.getDirectoryId());
            report.setNlp(testCase.getNlp());
            report.setUrl(testCase.getUrl());
            report.setYamlFlow(testCase.getYamlFlow());
        }

        if (response.getReportUrl() != null && !response.getReportUrl().isBlank()) {
            report.setResult(response.getReportUrl());
        }

        if (response.getError() != null && !response.getError().isBlank()) {
            report.setError(response.getError());
        }

        report.setCreatedAt(LocalDateTime.now());
        reportMapper.insert(report);
        apiExchangeMapper.updateReportIdByExecutionId(record.getExecutionId(), report.getId());

        log.info("[ExecutionStatusSync] Execution completed: caseId={}, status={}", caseId, mappedStatus);
    }

    private String reportName(TestCase testCase) {
        String baseName = testCase != null ? testCase.getName() : null;
        if (baseName == null || baseName.isBlank()) {
            baseName = "report";
        }
        String safeName = baseName.trim().replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]+", "_");
        if (safeName.length() > 80) {
            safeName = safeName.substring(0, 80);
        }
        return safeName + "-" + LocalDateTime.now().format(REPORT_NAME_TIME_FORMAT);
    }
}
