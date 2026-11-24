package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.AiConfig;
import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.LoginMethod;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.util.CaseContentDigest;
import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.ExecuteResponse;
import com.smarttesting.platform.model.FinalScriptPreview;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    @Resource
    private AiConfigService aiConfigService;

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

        log.info("[CaseExecution] Submitting case {} to execute service, customYaml={}, mode={}, headless={}",
                caseId, customYaml != null && !customYaml.isBlank(), executionMode, headless);

        // 组装与预览共用同一条代码路径，保证"预览即执行所见"
        ExecuteRequest request = buildExecuteRequest(testCase, customYaml, executionMode, null);
        request.setHeadless(headless != null ? headless : true);
        if ("YAML".equals(request.getExecutionMode()) && (request.getYamlScript() == null || request.getYamlScript().isBlank())) {
            throw new IllegalArgumentException("yaml脚本未生成");
        }
        if ("NLP".equals(request.getExecutionMode()) && (request.getNlp() == null || request.getNlp().isBlank())) {
            throw new IllegalArgumentException("NLP案例描述未填写");
        }
        if ("CODE".equals(request.getExecutionMode()) && (request.getScript() == null || request.getScript().isBlank())) {
            throw new IllegalArgumentException("录制脚本不存在，请先以 NLP/YAML 模式执行成功以生成录制脚本");
        }
        if ("CODE".equals(request.getExecutionMode()) && !"RECORDED".equalsIgnoreCase(testCase.getScriptStatus())) {
            String statusDesc = testCase.getScriptStatus() == null ? "NONE" : testCase.getScriptStatus();
            String hint = "STALE".equalsIgnoreCase(statusDesc)
                    ? "录制脚本已过期（NLP/YAML 已修改），请先以 NLP/YAML 模式重新执行成功以重新录制"
                    : "请先以 NLP/YAML 模式执行成功以生成录制脚本";
            throw new IllegalArgumentException("录制脚本状态为 " + statusDesc + "，无法以 CODE 模式执行：" + hint);
        }

        String executeServiceUrl = executeServiceUrlResolver.resolve(userId, testCase.getProjectId());
        ExecuteResponse response = executeServiceGateway.asyncExecute(executeServiceUrl, request);

        if (response == null || response.getExecutionId() == null) {
            throw new RuntimeException("Execute service 返回无效: " + response);
        }

        // 创建执行记录
        createExecutionRecord(caseId, response.getExecutionId(), batchId, executeServiceUrl, CaseContentDigest.digest(testCase));

        log.info("[CaseExecution] Case {} submitted, executionId: {}", caseId, response.getExecutionId());
        return response.getExecutionId();
    }

    /**
     * 预览最终下发执行机的 Midscene 脚本（只读，不下发）。
     * 基于用例已保存内容实时组装，与执行链路共用 buildExecuteRequest；缺失内容以 warnings 返回而非报错。
     */
    public FinalScriptPreview previewFinalScript(String caseId) {
        TestCase testCase = testCaseService.getById(caseId);
        if (testCase == null) {
            throw new IllegalArgumentException("用例不存在: " + caseId);
        }
        List<String> warnings = new ArrayList<>();
        ExecuteRequest request = buildExecuteRequest(testCase, null, null, warnings);

        FinalScriptPreview preview = new FinalScriptPreview();
        preview.setExecutionMode(request.getExecutionMode());
        preview.setYamlScript(request.getYamlScript());
        preview.setNlp(request.getNlp());
        preview.setScript(request.getScript());
        preview.setScriptStatus(testCase.getScriptStatus());
        preview.setTargetUrl(request.getTargetUrl());
        preview.setHeadless(request.getHeadless());
        preview.setTimeout(request.getTimeout());
        preview.setLoginMethod(request.getLoginMethod());
        preview.setWarnings(warnings);
        if (request.getLoginMethod() != null) {
            preview.setLoginYamlPreview(buildLoginYamlPreview(request.getLoginMethod()));
        }
        log.info("[CaseExecution] Final script preview built: caseId={}, mode={}, loginMethod={}",
                caseId, request.getExecutionMode(), request.getLoginMethod() != null);
        return preview;
    }

    /**
     * 组装下发执行机的 ExecuteRequest（执行与预览共用）。
     *
     * @param testCase      用例（已保存内容）
     * @param customYaml    自定义 YAML（可选，优先于 yamlFlow）
     * @param executionMode 指定执行模式（可选，缺省用用例配置）
     * @param warnings      告警收集器（可为 null；非 null 时缺失内容记录告警而非由调用方抛错）
     */
    public ExecuteRequest buildExecuteRequest(TestCase testCase, String customYaml, String executionMode, List<String> warnings) {
        String caseId = testCase.getId();
        String name = testCase.getName();

        String selectedMode = executionMode == null || executionMode.isBlank() ? testCase.getExecutionMode() : executionMode;
        String mode;
        if ("CODE".equalsIgnoreCase(selectedMode)) {
            mode = "CODE";
        } else if ("YAML".equalsIgnoreCase(selectedMode)) {
            mode = "YAML";
        } else {
            mode = "NLP";
        }
        String yamlScript = customYaml != null && !customYaml.isBlank() ? customYaml : testCase.getYamlFlow();
        if (warnings != null) {
            if ("YAML".equals(mode) && (yamlScript == null || yamlScript.isBlank())) {
                warnings.add("YAML 模式：yamlFlow 未生成，执行时将被拒绝（yaml脚本未生成）");
            }
            if ("NLP".equals(mode) && (testCase.getNlp() == null || testCase.getNlp().isBlank())) {
                warnings.add("NLP 模式：案例描述未填写，执行时将被拒绝（NLP案例描述未填写）");
            }
            if ("CODE".equals(mode)) {
                if (testCase.getScript() == null || testCase.getScript().isBlank()) {
                    warnings.add("CODE 模式：尚无录制脚本，执行时将被拒绝（需先以 NLP/YAML 模式执行成功生成录制脚本）");
                } else if ("STALE".equalsIgnoreCase(testCase.getScriptStatus())) {
                    warnings.add("CODE 模式：录制脚本已过期（NLP/YAML 已修改），执行时将被拒绝（需重新录制）");
                }
            }
        }

        ExecuteRequest request = new ExecuteRequest();
        request.setId(caseId);
        request.setName(name);
        request.setNlp(testCase.getNlp());
        request.setYamlScript(yamlScript);
        // CODE 模式：直接下发录制脚本（仅 RECORDED 状态可用；校验在 execute() 入口前置）
        if ("CODE".equals(mode)) {
            request.setScript(testCase.getScript());
            // 步骤截图模式取全局 AI 配置（ERROR=仅失败/兜底步骤，默认；ALL=全步骤截图）
            AiConfig aiConfig = aiConfigService.getCurrentConfig();
            request.setScreenshotMode(aiConfig != null && "ALL".equalsIgnoreCase(aiConfig.getCodeScreenshotMode()) ? "ALL" : "ERROR");
        }

        // 登录方式：非免登录时注入登录负载（执行已有用例同样需要登录阶段，否则 NLP 模式浏览器停在空白页）
        LoginMethod loginMethod = null;
        if (testCase.getLoginMethodId() != null && !testCase.getLoginMethodId().isBlank()) {
            loginMethod = loginMethodService.getById(testCase.getLoginMethodId());
            if (loginMethod != null && !"none".equals(loginMethod.getType())) {
                ExecuteRequest.LoginMethodPayload payload = new ExecuteRequest.LoginMethodPayload();
                payload.setId(loginMethod.getId());
                payload.setType(loginMethod.getType());
                payload.setLoginUrl(loginMethod.getLoginUrl());
                payload.setUsername(loginMethod.getUsername());
                payload.setPassword(loginMethod.getPassword());
                payload.setStepsNlp(loginMethod.getStepsNlp());
                payload.setYamlScript(loginMethod.getYamlScript());
                request.setLoginMethod(payload);
                log.info("[CaseExecution] Login method injected: id={}, type={}", loginMethod.getId(), loginMethod.getType());
                // 存量用例兼容：nlp 中若残留旧的登录前缀（"打开 xxx，输入登录名 xxx，密码 xxx…"），剥离后再下发
                // （登录由登录方式阶段独立执行，业务 NLP 重复登录会导致页面上下文错乱）
                if (request.getNlp() != null) {
                    request.setNlp(stripLegacyLoginPrefix(request.getNlp(), loginMethod));
                }
            }
        }
        request.setExecutionMode(mode);
        request.setTimeout(600 * 1000);
        request.setHeadless(true);
        request.setCacheContent(testCase.getCacheContent());
        projectExecutionSettingsService.apply(testCase.getProjectId(), request);

        // NLP/CODE 模式目标网址：从 YAML 中提取 web.url（两者本身不含网址时，执行引擎先导航再执行步骤）
        if ("NLP".equals(mode) || "CODE".equals(mode)) {
            String targetUrl = extractWebUrl(yamlScript);
            if (targetUrl != null) {
                request.setTargetUrl(targetUrl);
            } else if (warnings != null && yamlScript != null && !yamlScript.isBlank()) {
                warnings.add(mode + " 模式：YAML 中未提取到 web.url，执行时将不做前置导航（targetUrl 为空）");
            }
        }

        // YAML 模式且注入了登录方式：剔除 YAML 中的登录 task（登录由登录方式阶段独立缓存执行，避免重复登录）
        if ("YAML".equals(mode) && request.getLoginMethod() != null) {
            yamlScript = stripLoginTask(yamlScript);
            request.setYamlScript(yamlScript);
        }

        return request;
    }

    /**
     * 登录阶段 YAML 预览（仅用于前端展示）。
     * ⚠️ 模板与 execute-service/src/core/yaml-runner.ts buildLoginYaml 保持同步，修改任一侧需同步另一侧：
     * 优先使用预生成的 yamlScript；否则按 账号/密码/补充步骤 模板拼接，
     * 补充步骤中以 [动态] 开头的行 → 该步骤标记 cacheable: false（验证码等动态内容不缓存）。
     */
    private String buildLoginYamlPreview(ExecuteRequest.LoginMethodPayload lm) {
        if (lm.getYamlScript() != null && !lm.getYamlScript().trim().isEmpty()) {
            try {
                org.yaml.snakeyaml.Yaml yaml = new org.yaml.snakeyaml.Yaml();
                Object loaded = yaml.load(lm.getYamlScript());
                if (loaded instanceof Map) {
                    Object tasks = ((Map<?, ?>) loaded).get("tasks");
                    if (tasks != null) {
                        Map<String, Object> doc = new LinkedHashMap<>();
                        doc.put("tasks", tasks);
                        return yaml.dump(doc);
                    }
                }
            } catch (Exception e) {
                log.warn("[CaseExecution] buildLoginYamlPreview 解析登录 yamlScript 失败，按原样展示: {}", e.getMessage());
            }
            return lm.getYamlScript();
        }

        String username = lm.getUsername() == null ? "" : lm.getUsername();
        String password = lm.getPassword() == null ? "" : lm.getPassword();
        StringBuilder sb = new StringBuilder();
        sb.append("tasks:\n").append("  - name: 登录\n").append("    flow:\n");
        sb.append("      - aiInput: '").append(username.replace("'", "''")).append("'\n");
        sb.append("        locate: 账号或用户名输入框\n");
        sb.append("      - aiInput: '").append(password.replace("'", "''")).append("'\n");
        sb.append("        locate: 密码输入框\n");
        if (lm.getStepsNlp() != null) {
            for (String raw : lm.getStepsNlp().split("\n")) {
                String s = raw.trim();
                if (s.isEmpty()) continue;
                boolean dynamic = s.startsWith("[动态]");
                String text = dynamic ? s.substring(4).trim() : s;
                sb.append("      - aiAct: '").append(text.replace("'", "''")).append("'\n");
                if (dynamic) sb.append("        cacheable: false\n");
            }
        }
        sb.append("      - aiAct: '点击登录按钮，完成登录'\n");
        // 等待登录跳转完成，避免业务步骤在页面加载中执行（查询类步骤永不缓存，不影响登录缓存复用）
        sb.append("      - aiWaitFor: '登录已完成，页面已进入登录后的主界面'");
        return sb.toString();
    }

    private void createExecutionRecord(String caseId, String executionId, String batchId, String executeServiceUrl, String dispatchedContentHash) {
        ExecutionRecord record = new ExecutionRecord();
        record.setCaseId(caseId);
        record.setBatchId(batchId);
        record.setExecutionId(executionId);
        record.setExecuteServiceUrl(executeServiceUrl);
        record.setDispatchedContentHash(dispatchedContentHash);
        record.setStatus("RUNNING");
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        executionRecordMapper.insert(record);
        log.info("[CaseExecution] ExecutionRecord created: caseId={}, executionId={}", caseId, executionId);
    }

    /**
     * 剥离存量用例 nlp 中残留的登录前缀（旧版会把登录方式策略生成的 NLP 拼在业务步骤前）。
     * 匹配首段：打开 <url>，输入登录名 <账号>，密码 <密码>…（含补充步骤），剥离后返回纯业务步骤。
     */
    private String stripLegacyLoginPrefix(String nlp, LoginMethod lm) {
        if (nlp == null || nlp.isBlank() || lm.getUsername() == null) return nlp;
        String[] lines = nlp.split("\n", 2);
        String firstLine = lines[0].trim();
        boolean isLegacyLoginPrefix =
                firstLine.startsWith("打开") &&
                firstLine.contains("输入登录名") &&
                firstLine.contains(lm.getUsername());
        if (isLegacyLoginPrefix) {
            String rest = lines.length > 1 ? lines[1].trim() : "";
            log.info("[CaseExecution] 已剥离 nlp 中残留的登录前缀（登录由登录方式阶段执行）");
            return rest;
        }
        return nlp;
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
