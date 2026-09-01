package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.model.BatchExecuteRequest;
import com.smarttesting.platform.model.BatchExecuteResponse;
import com.smarttesting.platform.model.BatchProgressResponse;
import com.smarttesting.platform.model.CreateAndExecuteRequest;
import com.smarttesting.platform.model.CreateAndExecuteResponse;
import com.smarttesting.platform.model.DebugExecuteRequest;
import com.smarttesting.platform.model.ExecuteCaseRequest;
import com.smarttesting.platform.model.ExecuteStatusResponse;
import com.smarttesting.platform.service.BatchExecutionService;
import com.smarttesting.platform.service.CaseExecutionService;
import com.smarttesting.platform.service.CreateAndExecuteService;
import com.smarttesting.platform.service.DebugExecutionService;
import com.smarttesting.platform.service.ExecuteServiceGateway;
import com.smarttesting.platform.service.ExecuteServiceUrlResolver;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.validation.Valid;
import javax.validation.constraints.Size;
import java.util.Map;

@Tag(name = "Executions", description = "Single case, debug, batch execution and progress APIs")
@RestController
@RequestMapping("/api/platform/execute")
@Validated
public class ExecuteController {

    private static final Logger log = LoggerFactory.getLogger(ExecuteController.class);

    @Resource
    private CaseExecutionService caseExecutionService;

    @Resource
    private CreateAndExecuteService createAndExecuteService;

    @Resource
    private BatchExecutionService batchExecutionService;

    @Resource
    private ExecuteServiceUrlResolver executeServiceUrlResolver;

    @Resource
    private ExecutionRecordMapper executionRecordMapper;

    @Resource
    private ExecuteServiceGateway executeServiceGateway;

    @Resource
    private DebugExecutionService debugExecutionService;

    @Operation(summary = "Execute existing case", description = "Trigger async execution for an existing case and return executionId.")
    @PostMapping("/cases/{id}")
    public ResponseEntity<?> executeCase(@Parameter(description = "Case ID") @Size(max = 64) @PathVariable String id,
                                         @Parameter(description = "Optional execution overrides") @Valid @RequestBody(required = false) ExecuteCaseRequest body,
                                         Authentication authentication) {
        try {
            String customYaml = body != null ? body.getCustomYaml() : null;
            Boolean headless = body != null ? body.getHeadless() : null;
            String executionMode = body != null ? body.getExecutionMode() : null;
            Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
            String executionId = caseExecutionService.execute(id, customYaml, null, headless, userId, executionMode);
            return ResponseEntity.ok(Map.of("caseId", id, "executionId", executionId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Create case and execute", description = "Create a test case record, then immediately trigger async execution.")
    @PostMapping("/create-and-execute")
    public ResponseEntity<?> createAndExecute(@Valid @RequestBody CreateAndExecuteRequest request, Authentication authentication) {
        if (!"YAML".equalsIgnoreCase(request.getExecutionMode()) && (request.getNlp() == null || request.getNlp().isBlank())) {
            return ResponseEntity.badRequest().body(Map.of("error", "nlp is required unless executionMode is YAML"));
        }
        log.info("[Execute API] create-and-execute: projectId={}, name={}", request.getProjectId(), request.getName());

        try {
            Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
            executeServiceUrlResolver.resolve(userId, request.getProjectId());
            CreateAndExecuteResponse response = createAndExecuteService.createAndExecute(request, userId);
            if (!response.isSuccess()) {
                log.warn("[Execute API] Case created but execution submission failed: caseId={}, error={}",
                        response.getCaseId(), response.getError());
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[Execute API] create-and-execute failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Debug unsaved YAML or NLP", description = "Submit the current draft for execution without creating a case or execution record.")
    @PostMapping("/debug")
    public ResponseEntity<?> debug(@Valid @RequestBody DebugExecuteRequest request, Authentication authentication) {
        boolean yamlMode = "YAML".equalsIgnoreCase(request.getExecutionMode());
        if (yamlMode ? request.getYamlScript() == null || request.getYamlScript().isBlank()
                : request.getNlp() == null || request.getNlp().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", yamlMode ? "yamlScript is required" : "nlp is required"));
        }
        try {
            Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
            return ResponseEntity.accepted().body(debugExecutionService.execute(request, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("[Execute API] Debug execution submission failed", e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Debug execution submission failed"));
        }
    }

    @Operation(summary = "Cancel debug execution")
    @PostMapping("/debug/{executionId}/cancel")
    public ResponseEntity<?> cancelDebug(@Size(max = 128) @PathVariable String executionId) {
        try {
            debugExecutionService.cancel(executionId);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to cancel debug execution"));
        }
    }

    @Operation(summary = "Batch execute cases", description = "Submit multiple cases for batch execution. All cases must belong to the same project.")
    @PostMapping("/batch")
    public ResponseEntity<BatchExecuteResponse> batchExecute(@Valid @RequestBody BatchExecuteRequest request, Authentication authentication) {
        try {
            Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
            BatchExecuteResponse response = batchExecutionService.batchExecute(request.getCaseIds(), userId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new BatchExecuteResponse(null, 0, e.getMessage()));
        }
    }

    @Operation(summary = "Get batch progress")
    @GetMapping("/batch/{batchId}/progress")
    public ResponseEntity<BatchProgressResponse> getBatchProgress(@Size(max = 128) @PathVariable String batchId) {
        try {
            BatchProgressResponse response = batchExecutionService.getBatchProgress(batchId);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @Operation(summary = "Get execution status")
    @GetMapping("/{executionId}/status")
    public ResponseEntity<?> getExecutionStatus(@Size(max = 128) @PathVariable String executionId) {
        ExecutionRecord record = executionRecordMapper.selectByExecutionId(executionId);
        String executeServiceUrl = record != null ? record.getExecuteServiceUrl() : debugExecutionService.getExecuteServiceUrl(executionId);
        if (executeServiceUrl == null || executeServiceUrl.isBlank()) {
            if (record == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Execution task not found or expired"));
            }
            return ResponseEntity.badRequest().body(Map.of("error", "Execute service URL is missing"));
        }
        try {
            ExecuteStatusResponse response = executeServiceGateway.getStatus(executeServiceUrl, executionId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.warn("[Execute API] Failed to get status for executionId={} from {}", executionId, executeServiceUrl, e);
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", "Unable to get execution status"));
        }
    }
}
