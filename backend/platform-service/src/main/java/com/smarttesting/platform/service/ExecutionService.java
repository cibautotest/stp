package com.smarttesting.platform.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttesting.platform.entity.AiConfig;
import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.ExecuteResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 测试执行服务
 * 协调 Platform 与 Execute Service 之间的任务调度
 */
@Service
public class ExecutionService {

    private static final Logger log = LoggerFactory.getLogger(ExecutionService.class);

    @Resource
    private ExecuteServiceGateway executeServiceGateway;

    @Resource
    private ExecuteServiceUrlResolver executeServiceUrlResolver;

    @Resource
    private ExecutionRecordMapper executionRecordMapper;

    @Resource
    private TestCaseService testCaseService;

    @Resource
    private AiConfigService aiConfigService;

    @Resource
    private ProjectExecutionSettingsService projectExecutionSettingsService;

    /**
     * 触发测试执行
     */
    public Map<String, Object> executeTestCase(String caseId) {
        TestCase testCase = testCaseService.getById(caseId);
        if (testCase == null) {
            throw new IllegalArgumentException("Test case not found: " + caseId);
        }

        // 更新用例状态
        testCase.setStatus("RUNNING");
        testCase.setExecutedAt(LocalDateTime.now());
        testCaseService.updateById(testCase);

        // 保存 AI 配置快照
        AiConfig aiConfig = aiConfigService.getCurrentConfig();
        try {
            testCase.setAiConfigSnapshot(new ObjectMapper().writeValueAsString(aiConfig));
            testCaseService.updateById(testCase);
        } catch (JsonProcessingException e) {
            log.warn("Failed to save AI config snapshot", e);
        }

        // 构建 YAML
        String yaml = testCase.getYamlFlow();

        // 构建 Execute 请求
        ExecuteRequest request = new ExecuteRequest();
        request.setId(caseId);
        request.setName(extractName(testCase));
        request.setYamlScript(yaml);
        request.setNlp(testCase.getNlp());
        request.setExecutionMode("YAML");
        if (aiConfig != null) {
            request.setHeadless(aiConfig.getBrowserHeadless());
        }
        projectExecutionSettingsService.apply(testCase.getProjectId(), request);

        // 异步提交到 Execute Service
        try {
            log.info("[Execute] Submitting task for case: {}", caseId);
            String executeServiceUrl = executeServiceUrlResolver.resolve(null, testCase.getProjectId());
            ExecuteResponse response = executeServiceGateway.asyncExecute(executeServiceUrl, request);

            // 创建执行记录
            createExecutionRecord(caseId, response.getExecutionId(), executeServiceUrl);

            Map<String, Object> result = new HashMap<>();
            result.put("caseId", caseId);
            result.put("executionId", response.getExecutionId());
            result.put("status", response.getStatus());
            return result;
        } catch (Exception e) {
            log.error("[Execute] Failed to submit task to Execute service", e);
            testCase.setStatus("FAILED");
            testCaseService.updateById(testCase);
            throw new RuntimeException("Execute service is unavailable", e);
        }
    }

    private void createExecutionRecord(String caseId, String executionId, String executeServiceUrl) {
        ExecutionRecord record = new ExecutionRecord();
        record.setCaseId(caseId);
        record.setExecutionId(executionId);
        record.setExecuteServiceUrl(executeServiceUrl);
        record.setStatus("RUNNING");
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        executionRecordMapper.insert(record);
        log.info("[Execute] ExecutionRecord created: caseId={}, executionId={}", caseId, executionId);
    }

    private String extractName(TestCase testCase) {
        if (testCase.getName() != null && !testCase.getName().isBlank()) {
            return testCase.getName();
        }
        if (testCase.getNlp() != null && !testCase.getNlp().isBlank()) {
            String firstLine = testCase.getNlp().split("\n")[0];
            return firstLine.length() > 100 ? firstLine.substring(0, 100) : firstLine;
        }
        return "Unnamed Case";
    }
}
