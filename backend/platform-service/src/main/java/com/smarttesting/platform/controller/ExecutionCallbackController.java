package com.smarttesting.platform.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import com.smarttesting.platform.mapper.ReportMapper;
import com.smarttesting.platform.model.ExecutionCallbackRequest;
import com.smarttesting.platform.service.TestCaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Tag(name = "Execution Callback", description = "Execution engine callback APIs")
@RestController
@RequestMapping("/api/platform/callback")
public class ExecutionCallbackController {

    private static final Logger log = LoggerFactory.getLogger(ExecutionCallbackController.class);

    @Resource
    private TestCaseService testCaseService;

    @Resource
    private ReportMapper reportMapper;

    @Resource
    private ApiExchangeMapper apiExchangeMapper;

    @Operation(summary = "Receive execution result callback")
    @PostMapping("/execution-result")
    public ResponseEntity<?> onExecutionResult(@Valid @RequestBody ExecutionCallbackRequest body) {
        try {
            String caseId = body.getCaseId();
            String executionId = body.getExecutionId() != null ? body.getExecutionId() : body.getTaskId();
            String status = body.getStatus();
            String error = body.getError();
            String reportUrl = body.getReportUrl() != null ? body.getReportUrl() : body.getReportPath();
            List<String> logs = body.getLogs() != null ? body.getLogs() : List.of();
            String normalizedStatus = normalizeStatus(status);
            ObjectMapper objectMapper = new ObjectMapper();

            log.info("Received execution callback: caseId={}, executionId={}, status={}", caseId, executionId, status);

            TestCase testCase = testCaseService.getById(caseId);
            if (testCase != null) {
                testCase.setStatus(normalizedStatus);
                testCase.setExecutedAt(LocalDateTime.now());
                testCase.setReportGeneratedAt(LocalDateTime.now());
                if (reportUrl != null) {
                    testCase.setHtmlReportPath(reportUrl);
                    testCase.setFullReportPath(reportUrl);
                }
                testCaseService.updateById(testCase);
            }

            Report report = new Report();
            report.setCaseId(caseId);
            report.setStatus(normalizedStatus);
            report.setName(testCase != null ? testCase.getName() : caseId);
            report.setProjectId(testCase != null ? testCase.getProjectId() : null);
            report.setDirectoryId(testCase != null ? testCase.getDirectoryId() : null);
            report.setError(error);
            report.setNlp(testCase != null ? testCase.getNlp() : null);
            report.setUrl(testCase != null ? testCase.getUrl() : null);
            report.setYamlFlow(testCase != null ? testCase.getYamlFlow() : null);
            report.setDuration(body.getDuration());
            report.setResult(reportUrl);
            report.setCreatedAt(LocalDateTime.now());
            try {
                report.setLogs(objectMapper.writeValueAsString(logs));
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize logs", e);
            }
            reportMapper.insert(report);
            if (executionId != null) {
                apiExchangeMapper.updateReportIdByExecutionId(executionId, report.getId());
            }

            log.info("Execution result saved: caseId={}, status={}", caseId, status);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            log.error("Failed to process execution callback", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    private String normalizeStatus(String status) {
        if (status == null) {
            return "FAILED";
        }
        String normalized = status.trim().toUpperCase();
        if ("COMPLETED".equals(normalized) || "PASSED".equals(normalized)) {
            return "SUCCESS";
        }
        if ("ERROR".equals(normalized)) {
            return "FAILED";
        }
        return normalized;
    }
}
