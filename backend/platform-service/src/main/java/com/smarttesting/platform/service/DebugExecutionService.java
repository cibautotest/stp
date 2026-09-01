package com.smarttesting.platform.service;

import com.smarttesting.platform.model.DebugExecuteRequest;
import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.ExecuteResponse;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.concurrent.ConcurrentHashMap;

/** Executes unsaved drafts without creating a TestCase or execution record. */
@Service
public class DebugExecutionService {
    private final ConcurrentHashMap<String, String> executionServiceUrls = new ConcurrentHashMap<>();

    @Resource private ExecuteServiceUrlResolver executeServiceUrlResolver;
    @Resource private ExecuteServiceGateway executeServiceGateway;
    @Resource private ProjectExecutionSettingsService projectExecutionSettingsService;

    public ExecuteResponse execute(DebugExecuteRequest request, Long userId) {
        String executeServiceUrl = executeServiceUrlResolver.resolve(userId, request.getProjectId());
        ExecuteRequest executeRequest = new ExecuteRequest();
        executeRequest.setId("debug-" + java.util.UUID.randomUUID());
        executeRequest.setName(request.getName() == null || request.getName().isBlank() ? "未保存用例调试" : request.getName());
        executeRequest.setNlp(request.getNlp());
        String mode = "YAML".equalsIgnoreCase(request.getExecutionMode()) ? "YAML" : "NLP";
        if ("YAML".equals(mode) && (request.getYamlScript() == null || request.getYamlScript().isBlank())) {
            throw new IllegalArgumentException("yaml脚本未生成");
        }
        executeRequest.setYamlScript(request.getYamlScript());
        executeRequest.setExecutionMode(mode);
        executeRequest.setTimeout(600000);
        executeRequest.setHeadless(request.getHeadless() != null ? request.getHeadless() : true);
        projectExecutionSettingsService.apply(request.getProjectId(), executeRequest);
        ExecuteResponse response = executeServiceGateway.asyncExecute(executeServiceUrl, executeRequest);
        if (response == null || response.getExecutionId() == null) throw new RuntimeException("执行机返回无效响应");
        executionServiceUrls.put(response.getExecutionId(), executeServiceUrl);
        return response;
    }

    public String getExecuteServiceUrl(String executionId) {
        return executionServiceUrls.get(executionId);
    }

    public boolean cancel(String executionId) {
        String executeServiceUrl = executionServiceUrls.get(executionId);
        if (executeServiceUrl == null) throw new IllegalArgumentException("调试任务不存在或已过期");
        Object response = executeServiceGateway.cancel(executeServiceUrl, executionId);
        executionServiceUrls.remove(executionId);
        return response != null;
    }
}
