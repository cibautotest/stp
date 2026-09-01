package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.TestPlan;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.mapper.TestPlanCaseMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 计划执行服务 — 并行提交计划内所有用例，等待批次完成后再合并报告
 */
@Service
public class PlanExecutionService {

    private static final Logger log = LoggerFactory.getLogger(PlanExecutionService.class);

    /** 批次轮询间隔（毫秒） */
    private static final long POLL_INTERVAL_MS = 3000;
    /** 批次最大等待时间（毫秒） */
    private static final long MAX_BATCH_WAIT_MS = 30 * 60 * 1000;

    @Resource
    private TestPlanService testPlanService;

    @Resource
    private CaseExecutionService caseExecutionService;

    @Resource
    private BatchExecutionService batchExecutionService;

    @Resource
    private TestPlanCaseMapper testPlanCaseMapper;

    @Resource
    private ExecutionRecordMapper executionRecordMapper;

    /**
     * 异步执行测试计划
     * 阶段1: 并行提交所有用例到 execute-service（不等待单个完成）
     * 阶段2: 批量轮询批次完成
     * 阶段3: 合并报告并更新计划结果
     *
     * @param planId  计划ID
     * @param batchId 批次ID（前端传入或自动生成）
     */
    @Async
    public void executePlanAsync(String planId, String batchId) {
        executePlanAsync(planId, batchId, null);
    }

    @Async
    public void executePlanAsync(String planId, String batchId, Long userId) {
        // 1. 获取用例列表
        List<String> caseIds = testPlanCaseMapper.selectCaseIdsByPlanId(planId);
        if (caseIds.isEmpty()) {
            log.warn("[PlanExecution] Plan {} has no cases, skipping", planId);
            updatePlanResult(planId, batchId, 0, 0);
            return;
        }

        int total = caseIds.size();
        log.info("[PlanExecution] Starting plan {} execution, {} cases, batchId={}", planId, total, batchId);

        // ========== 阶段1: 并行提交所有用例 ==========
        Map<String, String> caseExecutionMap = new LinkedHashMap<>(); // caseId → executionId
        int submitFailed = 0;

        for (String caseId : caseIds) {
            try {
                String executionId = caseExecutionService.execute(caseId, null, batchId, null, userId);
                caseExecutionMap.put(caseId, executionId);
                log.info("[PlanExecution] Case {} submitted, executionId={}", caseId, executionId);
            } catch (Exception e) {
                log.error("[PlanExecution] Failed to submit case {} in plan {}", caseId, planId, e);
                submitFailed++;
            }
        }

        if (caseExecutionMap.isEmpty()) {
            log.error("[PlanExecution] All {} cases submission failed for plan {}", total, planId);
            updatePlanResult(planId, batchId, total, total);
            return;
        }

        int submitted = caseExecutionMap.size();
        log.info("[PlanExecution] Phase 1 done: {}/{} cases submitted, {} failed, now waiting for batch completion",
                submitted, total, submitFailed);

        // ========== 阶段2: 等待批次全部完成 ==========
        waitForBatchCompletion(planId, batchId, submitted);

        // ========== 阶段3: 统计结果、合并报告、更新计划 ==========
        List<ExecutionRecord> records = executionRecordMapper.selectByBatchId(batchId);
        long successCount = records.stream().filter(r -> "SUCCESS".equals(r.getStatus())).count();
        long failedCount = records.stream().filter(r -> "FAILED".equals(r.getStatus())).count();
        failedCount += submitFailed; // 提交失败的也算失败

        log.info("[PlanExecution] Plan {} execution finished: {} total, {} success, {} failed",
                planId, total, successCount, failedCount);

        // 合并报告
        TestPlan plan = testPlanService.getById(planId);
        String planName = plan != null ? plan.getName() : null;
        try {
            batchExecutionService.checkAndMergeBatch(batchId, planName);
        } catch (Exception e) {
            log.error("[PlanExecution] Error merging batch {} for plan {}", batchId, planId, e);
        }

        // 更新计划执行历史
        updatePlanResult(planId, batchId, (int) failedCount, total);
    }

    /**
     * 批量轮询等待批次内所有用例执行完成
     * 通过 batchId 检查 RUNNING 记录数，全部完成（含 SUCCESS/FAILED）后返回
     *
     * @param planId        计划ID（日志用）
     * @param batchId       批次ID
     * @param expectedCount 期望完成的记录数
     */
    private void waitForBatchCompletion(String planId, String batchId, int expectedCount) {
        long startTime = System.currentTimeMillis();

        while (System.currentTimeMillis() - startTime < MAX_BATCH_WAIT_MS) {
            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                log.warn("[PlanExecution] Batch polling interrupted for plan {}", planId);
                return;
            }

            int runningCount = executionRecordMapper.countRunningByBatchId(batchId);
            if (runningCount == 0) {
                List<ExecutionRecord> records = executionRecordMapper.selectByBatchId(batchId);
                if (records.size() >= expectedCount) {
                    log.info("[PlanExecution] Batch {} all complete: {} records", batchId, records.size());
                    return;
                }
                log.debug("[PlanExecution] Batch {} has {} records (expect {}), waiting for more",
                        batchId, records.size(), expectedCount);
            } else {
                log.debug("[PlanExecution] Batch {} still has {} running tasks", batchId, runningCount);
            }
        }

        log.warn("[PlanExecution] Batch {} wait timed out after {}ms", batchId, MAX_BATCH_WAIT_MS);
    }

    /**
     * 更新计划的执行历史字段
     */
    private void updatePlanResult(String planId, String batchId, int failedCount, int total) {
        TestPlan plan = testPlanService.getById(planId);
        if (plan == null) {
            log.warn("[PlanExecution] Plan {} not found, cannot update result", planId);
            return;
        }

        plan.setLastExecutedAt(LocalDateTime.now());
        plan.setLastBatchId(batchId);

        if (total == 0) {
            plan.setLastExecutionResult("NO_CASES");
        } else if (failedCount == 0) {
            plan.setLastExecutionResult("PASSED");
        } else if (failedCount == total) {
            plan.setLastExecutionResult("FAILED");
        } else {
            plan.setLastExecutionResult(failedCount + "_FAILED");
        }

        testPlanService.updateById(plan);
        log.info("[PlanExecution] Plan {} result updated: {}, batchId={}", planId, plan.getLastExecutionResult(), batchId);
    }

    /**
     * 生成唯一的 batchId
     */
    public static String generateBatchId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 16);
    }
}
