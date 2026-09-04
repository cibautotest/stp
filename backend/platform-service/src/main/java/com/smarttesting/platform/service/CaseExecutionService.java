package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.LoginMethod;
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

    @Resource
    private LoginMethodService loginMethodService;

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

        // 登录方式：非免登录时注入登录负载（执行已有用例同样需要登录阶段，否则 NLP 模式浏览器停在空白页）
        if (testCase.getLoginMethodId() != null && !testCase.getLoginMethodId().isBlank()) {
            LoginMethod lm = loginMethodService.getById(testCase.getLoginMethodId());
            if (lm != null && !"none".equals(lm.getType())) {
                ExecuteRequest.LoginMethodPayload payload = new ExecuteRequest.LoginMethodPayload();
                payload.setId(lm.getId());
                payload.setType(lm.getType());
                payload.setLoginUrl(lm.getLoginUrl());
                payload.setUsername(lm.getUsername());
                payload.setPassword(lm.getPassword());
                payload.setStepsNlp(lm.getStepsNlp());
                payload.setYamlScript(lm.getYamlScript());
                request.setLoginMethod(payload);
                log.info("[CaseExecution] Login method injected: id={}, type={}", lm.getId(), lm.getType());
            }
        }

        // NLP 模式目标网址：从 YAML 中提取 web.url（NLP 本身不含网址时，执行引擎先导航再执行步骤）
        if ("NLP".equals(mode)) {
            String targetUrl = extractWebUrl(yamlScript);
            if (targetUrl != null) {
                request.setTargetUrl(targetUrl);
            }
        }

        // YAML 模式且注入了登录方式：剔除 YAML 中的登录 task（登录由登录方式阶段独立缓存执行，避免重复登录）
        if ("YAML".equals(mode) && request.getLoginMethod() != null) {
            yamlScript = stripLoginTask(yamlScript);
            request.setYamlScript(yamlScript);
        }

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

    /**
     * 从 YAML 文本中提取 web.url（用于 NLP 模式的目标页面导航）
     */
    private String extractWebUrl(String yamlScript) {
        if (yamlScript == null || yamlScript.isBlank()) return null;
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(?m)^\\s*url:\\s*(https?://\\S+)\\s*$")
                .matcher(yamlScript);
        return m.find() ? m.group(1) : null;
    }

    /**
     * 剔除 YAML 中 name 以「登录」开头的 task（登录由登录方式阶段独立执行）
     */
    @SuppressWarnings("unchecked")
    private String stripLoginTask(String yamlScript) {
        if (yamlScript == null || yamlScript.isBlank()) return yamlScript;
        try {
            org.yaml.snakeyaml.Yaml yaml = new org.yaml.snakeyaml.Yaml();
            Object loaded = yaml.load(yamlScript);
            if (!(loaded instanceof java.util.Map)) return yamlScript;
            java.util.Map<String, Object> doc = (java.util.Map<String, Object>) loaded;
            Object tasks = doc.get("tasks");
            if (!(tasks instanceof java.util.List) || ((java.util.List<?>) tasks).size() <= 1) return yamlScript;
            java.util.List<Object> rest = new java.util.ArrayList<>();
            boolean removed = false;
            for (Object t : (java.util.List<?>) tasks) {
                if (t instanceof java.util.Map) {
                    Object name = ((java.util.Map<?, ?>) t).get("name");
                    if (name != null && String.valueOf(name).startsWith("登录")) {
                        removed = true;
                        continue;
                    }
                }
                rest.add(t);
            }
            if (removed && !rest.isEmpty()) {
                doc.put("tasks", rest);
                log.info("[CaseExecution] 已剔除 YAML 中的登录 task（由登录方式阶段执行）");
                return yaml.dump(doc);
            }
        } catch (Exception e) {
            log.warn("[CaseExecution] stripLoginTask 解析失败，按原样执行: {}", e.getMessage());
        }
        return yamlScript;
    }

}
