package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import com.smarttesting.platform.mapper.ProjectMapper;
import com.smarttesting.platform.mapper.ReportMapper;
import com.smarttesting.platform.mapper.TestCaseMapper;
import com.smarttesting.platform.model.BatchExecuteResponse;
import com.smarttesting.platform.model.BatchProgressResponse;
import com.smarttesting.platform.model.MergeReportRequest;
import com.smarttesting.platform.model.MergeReportResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 批量执行服务
 * 负责批量提交用例执行、进度查询、合并报告
 */
@Service
public class BatchExecutionService {

    private static final Logger log = LoggerFactory.getLogger(BatchExecutionService.class);

    /** 用于防止并发重复触发合并的批次ID集合 */
    private final Set<String> mergingBatches = new HashSet<>();

    @Resource
    private TestCaseMapper testCaseMapper;

    @Resource
    private ProjectMapper projectMapper;

    @Resource
    private ExecutionRecordMapper executionRecordMapper;

    @Resource
    private ReportMapper reportMapper;

    @Resource
    private ApiExchangeMapper apiExchangeMapper;

    @Resource
    private CaseExecutionService caseExecutionService;

    @Resource
    private ExecuteServiceUrlResolver executeServiceUrlResolver;

    @Resource
    private ExecuteServiceGateway executeServiceGateway;

    /**
     * 批量执行用例
     * 验证所有用例属于同一项目 → 生成 batchId → 逐个提交执行
     */
    public BatchExecuteResponse batchExecute(List<String> caseIds) {
        return batchExecute(caseIds, null);
    }

    public BatchExecuteResponse batchExecute(List<String> caseIds, Long userId) {
        if (caseIds == null || caseIds.isEmpty()) {
            throw new IllegalArgumentException("用例ID列表不能为空");
        }

        // 查询所有用例
        List<TestCase> cases = testCaseMapper.selectBatchIds(caseIds);
        if (cases.size() != caseIds.size()) {
            Set<String> foundIds = cases.stream().map(TestCase::getId).collect(Collectors.toSet());
            List<String> missing = caseIds.stream().filter(id -> !foundIds.contains(id)).collect(Collectors.toList());
            throw new IllegalArgumentException("以下用例不存在: " + missing);
        }

        // 验证所有用例属于同一项目
        Set<String> projectIds = cases.stream()
                .map(TestCase::getProjectId)
                .collect(Collectors.toSet());
        if (projectIds.size() > 1) {
            throw new IllegalArgumentException("批量执行仅支持同一项目下的用例");
        }

        String batchId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String projectId = cases.get(0).getProjectId();
        // Validate once before submitting any case so callers receive a clear configuration error.
        executeServiceUrlResolver.resolve(userId, projectId);

        log.info("[BatchExecution] Starting batch {} with {} cases, projectId={}", batchId, caseIds.size(), projectId);

        // 逐个提交执行
        int submitted = 0;
        List<String> failedCases = new ArrayList<>();
        for (TestCase testCase : cases) {
            try {
                caseExecutionService.execute(testCase.getId(), null, batchId, null, userId);
                submitted++;
            } catch (Exception e) {
                log.error("[BatchExecution] Failed to submit case {} to batch {}", testCase.getId(), batchId, e);
                failedCases.add(testCase.getId());
            }
        }

        // 所有用例提交均失败，直接报错
        if (submitted == 0) {
            throw new RuntimeException("所有用例提交执行均失败，共 " + failedCases.size() + " 个用例");
        }

        String message = "已提交 " + submitted + " 个用例执行";
        if (!failedCases.isEmpty()) {
            message += "，" + failedCases.size() + " 个提交失败";
        }

        // 异步监控批次完成，触发合并
        monitorBatchCompletion(batchId);

        return new BatchExecuteResponse(
                batchId,
                submitted,
                message
        );
    }

    /**
     * 查询批次执行进度
     * 如果批次记录尚未创建（异步执行尚未启动），返回 PENDING 状态而不是 404
     */
    public BatchProgressResponse getBatchProgress(String batchId) {
        List<ExecutionRecord> records = executionRecordMapper.selectByBatchId(batchId);
        if (records.isEmpty()) {
            BatchProgressResponse pendingResponse = new BatchProgressResponse();
            pendingResponse.setBatchId(batchId);
            pendingResponse.setTotal(0);
            pendingResponse.setCompleted(0);
            pendingResponse.setSuccess(0);
            pendingResponse.setFailed(0);
            pendingResponse.setRunning(0);
            pendingResponse.setStatus("PENDING");
            pendingResponse.setCases(new ArrayList<>());
            return pendingResponse;
        }

        BatchProgressResponse response = new BatchProgressResponse();
        response.setBatchId(batchId);
        response.setTotal(records.size());

        int completed = 0;
        int success = 0;
        int failed = 0;
        int running = 0;

        List<BatchProgressResponse.BatchCaseStatus> caseStatuses = new ArrayList<>();
        String projectId = null;
        String projectName = null;

        for (ExecutionRecord record : records) {
            TestCase testCase = testCaseMapper.selectById(record.getCaseId());

            BatchProgressResponse.BatchCaseStatus cs = new BatchProgressResponse.BatchCaseStatus();
            cs.setCaseId(record.getCaseId());
            cs.setCaseName(testCase != null ? testCase.getName() : "");
            cs.setExecutionId(record.getExecutionId());
            cs.setStatus(record.getStatus());
            caseStatuses.add(cs);

            if (testCase != null && projectId == null) {
                projectId = testCase.getProjectId();
                Project project = projectMapper.selectById(projectId);
                projectName = project != null ? project.getName() : "";
            }

            switch (record.getStatus()) {
                case "SUCCESS":
                    completed++;
                    success++;
                    break;
                case "FAILED":
                    completed++;
                    failed++;
                    break;
                case "RUNNING":
                default:
                    running++;
                    break;
            }
        }

        response.setProjectId(projectId);
        response.setProjectName(projectName);
        response.setCompleted(completed);
        response.setSuccess(success);
        response.setFailed(failed);
        response.setRunning(running);
        response.setCases(caseStatuses);
        response.setStatus(completed == records.size() ? "COMPLETED" : "RUNNING");

        // 查询合并报告URL
        Report batchReport = reportMapper.selectOne(
                new LambdaQueryWrapper<Report>()
                        .eq(Report::getBatchId, batchId)
                        .eq(Report::getType, "BATCH")
                        .last("LIMIT 1")
        );
        if (batchReport != null && batchReport.getMergedReportPath() != null) {
            response.setMergedReportUrl(batchReport.getResult());
        }

        return response;
    }

    /**
     * 检测批次是否全部完成，如果完成则触发合并
     * 带幂等保护：同一 batchId 只合并一次
     *
     * @param batchId  批次ID
     * @param planName 计划名称（从测试计划发起时传入，用于报告命名；否则为 null）
     */
    public void checkAndMergeBatch(String batchId, String planName) {
        // 幂等保护
        synchronized (mergingBatches) {
            if (mergingBatches.contains(batchId)) {
                log.debug("[BatchExecution] Batch {} is already merging, skip", batchId);
                return;
            }
            mergingBatches.add(batchId);
        }

        try {
            doCheckAndMerge(batchId, planName);
        } finally {
            synchronized (mergingBatches) {
                mergingBatches.remove(batchId);
            }
        }
    }

    /**
     * 无计划名称的重载（向后兼容）
     */
    public void checkAndMergeBatch(String batchId) {
        checkAndMergeBatch(batchId, null);
    }

    /**
     * 异步监控批次执行完成（用于直接批量执行，非计划执行路径）
     * 定期检查批次是否全部完成，完成后触发报告合并
     */
    @Async
    public void monitorBatchCompletion(String batchId) {
        final long MAX_WAIT_MS = 30 * 60 * 1000; // 最大等待 30 分钟
        final long POLL_INTERVAL_MS = 5000;      // 每 5 秒检查一次
        long startTime = System.currentTimeMillis();

        log.info("[BatchExecution] Starting batch completion monitor for batchId={}", batchId);

        while (System.currentTimeMillis() - startTime < MAX_WAIT_MS) {
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("[BatchExecution] Batch monitor interrupted for batchId={}", batchId);
                return;
            }

            int runningCount = executionRecordMapper.countRunningByBatchId(batchId);
            if (runningCount == 0) {
                int totalCount = executionRecordMapper.selectByBatchId(batchId).size();
                if (totalCount > 0) {
                    log.info("[BatchExecution] All {} records completed for batchId={}, triggering merge",
                            totalCount, batchId);
                    checkAndMergeBatch(batchId);
                    return;
                }
            }
        }

        log.warn("[BatchExecution] Batch monitor timed out for batchId={}", batchId);
        // 超时也尝试合并
        checkAndMergeBatch(batchId);
    }

    private void doCheckAndMerge(String batchId, String planName) {
        // 检查是否还有 RUNNING 的记录
        int runningCount = executionRecordMapper.countRunningByBatchId(batchId);
        if (runningCount > 0) {
            log.debug("[BatchExecution] Batch {} still has {} running tasks", batchId, runningCount);
            return;
        }

        // 检查是否已经有 BATCH 报告（幂等）
        Report existingReport = reportMapper.selectOne(
                new LambdaQueryWrapper<Report>()
                        .eq(Report::getBatchId, batchId)
                        .eq(Report::getType, "BATCH")
                        .last("LIMIT 1")
        );
        if (existingReport != null) {
            log.debug("[BatchExecution] Batch {} already has merged report, skip", batchId);
            return;
        }

        // 获取所有 executionIds
        List<ExecutionRecord> records = executionRecordMapper.selectByBatchId(batchId);
        List<String> executionIds = records.stream()
                .map(ExecutionRecord::getExecutionId)
                .collect(Collectors.toList());

        if (executionIds.isEmpty()) {
            log.warn("[BatchExecution] Batch {} has no execution records", batchId);
            return;
        }

        // 调用 Execute Service 合并报告
        MergeReportRequest mergeRequest = new MergeReportRequest();
        mergeRequest.setExecutionIds(executionIds);
        mergeRequest.setBatchName("batch-" + batchId);

        log.info("[BatchExecution] Merging reports for batch {}, {} executions", batchId, executionIds.size());

        MergeReportResponse mergeResponse;
        try {
            mergeResponse = executeServiceGateway.mergeReports(records.get(0).getExecuteServiceUrl(), mergeRequest);
        } catch (Exception e) {
            log.error("[BatchExecution] Failed to merge reports for batch {}", batchId, e);
            return;
        }

        if (mergeResponse == null || !Boolean.TRUE.equals(mergeResponse.getSuccess())) {
            log.error("[BatchExecution] Merge failed for batch {}: {}", batchId,
                    mergeResponse != null ? mergeResponse.getError() : "null response");
            return;
        }

        // 计算汇总信息
        long successCount = records.stream().filter(r -> "SUCCESS".equals(r.getStatus())).count();
        long failedCount = records.stream().filter(r -> "FAILED".equals(r.getStatus())).count();
        long totalDuration = 0;
        for (ExecutionRecord r : records) {
            if (r.getDuration() != null) {
                totalDuration += r.getDuration();
            }
        }

        // 获取项目信息
        String projectId = null;
        String batchName = "report-" + java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyMMddHHmmss"));
        String batchNlp = "";
        for (ExecutionRecord r : records) {
            TestCase tc = testCaseMapper.selectById(r.getCaseId());
            if (tc != null) {
                projectId = tc.getProjectId();
                batchNlp = tc.getNlp();
                break;
            }
        }

        // 创建 BATCH 类型报告
        Report batchReport = new Report();
        batchReport.setCaseId("");  // BATCH 报告不关联单个用例
        batchReport.setBatchId(batchId);
        batchReport.setType("BATCH");
        batchReport.setName(batchName);
        batchReport.setProjectId(projectId);
        batchReport.setStatus(failedCount == 0 ? "SUCCESS" : "FAILED");
        batchReport.setDuration(totalDuration);
        batchReport.setNlp(batchNlp);
        batchReport.setMergedReportPath(mergeResponse.getMergedReportPath());
        batchReport.setResult(mergeResponse.getMergedReportUrl());
        batchReport.setCreatedAt(LocalDateTime.now());
        reportMapper.insert(batchReport);
        for (ExecutionRecord record : records) {
            apiExchangeMapper.updateReportIdByExecutionId(record.getExecutionId(), batchReport.getId());
        }

        log.info("[BatchExecution] Batch {} merged report created, success={}, failed={}",
                batchId, successCount, failedCount);
    }
}
