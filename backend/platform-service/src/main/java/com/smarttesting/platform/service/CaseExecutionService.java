package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.ExecuteResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;

/**
 * 用例执行服务
 * 负责已有用例的执行：将 nlp/yamlFlow/url 组装后提交到 Execute Service
 */
@Service
public class CaseExecutionService {

    private static final Logger log = LoggerFactory.getLogger(CaseExecutionService.class);

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

    /**
     * 执行已有用例（异步），返回 executionId
     *
     * @param caseId     用例ID
     * @param customYaml 自定义 YAML（可选，不传则使用用例存储的 yamlFlow）
     * @return executionId
     */
    public String execute(String caseId, String customYaml) {
        return execute(caseId, customYaml, null, null);
    }

    /**
     * 执行已有用例（异步），支持批量执行时附带 batchId
     *
     * @param caseId     用例ID
     * @param customYaml 自定义 YAML（可选）
     * @param batchId    批次ID（可选）
     * @return executionId
     */
    public String execute(String caseId, String customYaml, String batchId) {
        return execute(caseId, customYaml, batchId, null);
    }

    /**
     * 执行已有用例（异步），支持指定 headless 模式
     *
     * @param caseId     用例ID
     * @param customYaml 自定义 YAML（可选）
     * @param batchId    批次ID（可选）
     * @param headless   是否无头模式（null 则默认 true）
     * @return executionId
     */
    public String execute(String caseId, String customYaml, String batchId, Boolean headless) {
        return execute(caseId, customYaml, batchId, headless, null);
    }

    public String execute(String caseId, String customYaml, String batchId, Boolean headless, Long userId) {
        return execute(caseId, customYaml, batchId, headless, userId, null);
    }

    public String execute(String caseId, String customYaml, String batchId, Boolean headless, Long userId, String executionMode) {
        TestCase testCase = testCaseService.getById(caseId);
        if (testCase == null) {
            throw new IllegalArgumentException("用例不存在: " + caseId);
        }

        String name = testCase.getName();

        String selectedMode = executionMode == null || executionMode.isBlank() ? testCase.getExecutionMode() : executionMode;
        String mode = "YAML".equalsIgnoreCase(selectedMode) ? "YAML" : "NLP";
        String yamlScript = customYaml != null && !customYaml.isBlank() ? customYaml : testCase.getYamlFlow();
        if ("YAML".equals(mode) && (yamlScript == null || yamlScript.isBlank())) {
            throw new IllegalArgumentException("yaml脚本未生成");
        }
        if ("NLP".equals(mode) && (testCase.getNlp() == null || testCase.getNlp().isBlank())) {
            throw new IllegalArgumentException("NLP案例描述未填写");
        }
        log.info("[CaseExecution] Submitting case {} to execute service, mode={}, headless={}", caseId, mode, headless);

        ExecuteRequest request = new ExecuteRequest();
        request.setId(caseId);
        request.setName(name);
        request.setNlp(testCase.getNlp());
        request.setYamlScript(yamlScript);
        request.setExecutionMode(mode);
        request.setTimeout(600 * 1000);
        request.setHeadless(headless != null ? headless : true);
        request.setCacheContent(testCase.getCacheContent());
        projectExecutionSettingsService.apply(testCase.getProjectId(), request);

        String executeServiceUrl = executeServiceUrlResolver.resolve(userId, testCase.getProjectId());
        ExecuteResponse response = executeServiceGateway.asyncExecute(executeServiceUrl, request);

        if (response == null || response.getExecutionId() == null) {
            throw new RuntimeException("Execute service 返回无效: " + response);
        }

        // 创建执行记录
        createExecutionRecord(caseId, response.getExecutionId(), batchId, executeServiceUrl);

        log.info("[CaseExecution] Case {} submitted, executionId: {}", caseId, response.getExecutionId());
        return response.getExecutionId();
    }

    private void createExecutionRecord(String caseId, String executionId, String batchId, String executeServiceUrl) {
        ExecutionRecord record = new ExecutionRecord();
        record.setCaseId(caseId);
        record.setBatchId(batchId);
        record.setExecutionId(executionId);
        record.setExecuteServiceUrl(executeServiceUrl);
        record.setStatus("RUNNING");
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        executionRecordMapper.insert(record);
        log.info("[CaseExecution] ExecutionRecord created: caseId={}, executionId={}", caseId, executionId);
    }

}
