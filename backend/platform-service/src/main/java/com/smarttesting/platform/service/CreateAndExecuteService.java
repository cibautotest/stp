package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.LoginMethod;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.model.CreateAndExecuteRequest;
import com.smarttesting.platform.model.CreateAndExecuteResponse;
import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.ExecuteResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;

/**
 * 创建测试用例并异步执行编排服务
 * 流程：创建 TestCase 记录 → 调用 execute-service 异步执行 → 返回 caseId + executionId
 */
@Service
public class CreateAndExecuteService {

    private static final Logger log = LoggerFactory.getLogger(CreateAndExecuteService.class);

    @Resource
    private TestCaseService testCaseService;

    @Resource
    private ExecuteServiceGateway executeServiceGateway;

    @Resource
    private ExecuteServiceUrlResolver executeServiceUrlResolver;

    @Resource
    private ExecutionRecordMapper executionRecordMapper;

    @Resource
    private ProjectExecutionSettingsService projectExecutionSettingsService;

    @Resource
    private LoginMethodService loginMethodService;

    /**
     * 创建用例并触发异步执行
     *
     * @param request 创建请求（projectId, name, nlp, customYaml）
     * @return caseId 和 executionId
     */
    public CreateAndExecuteResponse createAndExecute(CreateAndExecuteRequest request, Long userId) {
        // Step 1: 构建 TestCase 并保存
        TestCase testCase = new TestCase();
        testCase.setProjectId(request.getProjectId());
        testCase.setDirectoryId(request.getDirectoryId());
        testCase.setLoginMethodId(request.getLoginMethodId());
        testCase.setName(request.getName() != null ? request.getName() : extractName(request.getNlp()));
        testCase.setDescription(request.getDescription());
        testCase.setNlp(request.getNlp());
        testCase.setYamlFlow(request.getCustomYaml() != null ? request.getCustomYaml() : "");
        testCase.setStatus("PENDING");
        testCase.setCreatedAt(LocalDateTime.now());
        testCase.setUpdatedAt(LocalDateTime.now());
        testCaseService.save(testCase);

        String caseId = testCase.getId();
        log.info("[CreateAndExecute] TestCase created: id={}, name={}, projectId={}", caseId, testCase.getName(), request.getProjectId());

        // Step 2: 调用 execute-service 异步执行
        ExecuteRequest executeRequest = new ExecuteRequest();
        executeRequest.setId(caseId);
        executeRequest.setName(testCase.getName());
        executeRequest.setTimeout(600000);
        executeRequest.setHeadless(request.getHeadless() != null ? request.getHeadless() : true);
        // yamlScript: 优先使用 customYaml（已转好的 YAML），fallback 到 NLP 原始文本
        executeRequest.setNlp(request.getNlp());
        String mode = "YAML".equalsIgnoreCase(request.getExecutionMode()) ? "YAML" : "NLP";
        String yamlScript = request.getCustomYaml();
        if ("YAML".equals(mode) && (yamlScript == null || yamlScript.isBlank())) {
            throw new IllegalArgumentException("yaml脚本未生成");
        }
        executeRequest.setYamlScript(yamlScript);
        executeRequest.setExecutionMode(mode);
        projectExecutionSettingsService.apply(request.getProjectId(), executeRequest);

        // 登录方式：非免登录时注入登录负载（存量用例无 loginMethodId 时按免登录兼容）
        if (request.getLoginMethodId() != null && !request.getLoginMethodId().isBlank()) {
            LoginMethod lm = loginMethodService.getById(request.getLoginMethodId());
            if (lm != null && !"none".equals(lm.getType())) {
                ExecuteRequest.LoginMethodPayload payload = new ExecuteRequest.LoginMethodPayload();
                payload.setId(lm.getId());
                payload.setType(lm.getType());
                payload.setLoginUrl(lm.getLoginUrl());
                payload.setUsername(lm.getUsername());
                payload.setPassword(lm.getPassword());
                payload.setStepsNlp(lm.getStepsNlp());
                payload.setYamlScript(lm.getYamlScript());
                executeRequest.setLoginMethod(payload);
                log.info("[CreateAndExecute] Login method injected: id={}, type={}, role={}", lm.getId(), lm.getType(), lm.getRoleName());
            }
        }

        String executionId = null;
        String execError = null;
        String executeServiceUrl = null;
        try {
            log.info("[CreateAndExecute] Calling execute asyncExecute for case: {}", caseId);
            executeServiceUrl = executeServiceUrlResolver.resolve(userId, request.getProjectId());
            ExecuteResponse response = executeServiceGateway.asyncExecute(executeServiceUrl, executeRequest);
            executionId = response != null ? response.getExecutionId() : null;
        } catch (Exception e) {
            log.error("[CreateAndExecute] Execute asyncExecute call failed for case: {}", caseId, e);
            execError = "Failed to submit execution to execute service: " + e.getMessage();
        }

        if (executionId == null) {
            // 用例已保存，但执行提交失败 → 设置 TestCase 状态为 FAILED
            testCase.setStatus("FAILED");
            testCase.setExecutedAt(LocalDateTime.now());
            testCaseService.updateById(testCase);

            log.warn("[CreateAndExecute] Case saved but execution submission failed: caseId={}, error={}", caseId, execError);

            CreateAndExecuteResponse result = new CreateAndExecuteResponse();
            result.setCaseId(caseId);
            result.setExecutionId(null);
            result.setSuccess(false);
            result.setError(execError != null ? execError : "Execute service response missing executionId");
            return result;
        }

        // 创建执行记录
        createExecutionRecord(caseId, executionId, executeServiceUrl);

        log.info("[CreateAndExecute] Execution submitted: caseId={}, executionId={}", caseId, executionId);

        // Step 3: 返回成功结果
        CreateAndExecuteResponse result = new CreateAndExecuteResponse();
        result.setCaseId(caseId);
        result.setExecutionId(executionId);
        result.setSuccess(true);
        return result;
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
        log.info("[CreateAndExecute] ExecutionRecord created: caseId={}, executionId={}", caseId, executionId);
    }

    /**
     * 从 NLP 提取第一行作为用例名称
     */
    private String extractName(String nlp) {
        if (nlp == null || nlp.isBlank()) {
            return "Unnamed Test";
        }
        String firstLine = nlp.strip().split("\\r?\\n")[0];
        return firstLine.length() > 100 ? firstLine.substring(0, 100) : firstLine;
    }
}
