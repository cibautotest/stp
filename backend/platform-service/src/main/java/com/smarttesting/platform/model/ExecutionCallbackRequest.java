package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@Data
@Schema(description = "Execution result callback request")
public class ExecutionCallbackRequest {

    @NotBlank(message = "caseId is required")
    @Size(max = 64, message = "caseId length must be at most 64")
    @Schema(description = "Case ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String caseId;

    @Size(max = 128, message = "executionId length must be at most 128")
    @Schema(description = "Execution ID", maxLength = 128)
    private String executionId;

    @Size(max = 128, message = "taskId length must be at most 128")
    @Schema(description = "Legacy task ID", maxLength = 128)
    private String taskId;

    @NotBlank(message = "status is required")
    @Pattern(regexp = "PENDING|RUNNING|SUCCESS|FAILED|PASSED|ERROR|CANCELLED|pending|running|success|failed|passed|error|cancelled", message = "status is invalid")
    @Schema(description = "Execution status", requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"PENDING", "RUNNING", "SUCCESS", "FAILED", "PASSED", "ERROR", "CANCELLED"})
    private String status;

    @Size(max = 4000, message = "error length must be at most 4000")
    @Schema(description = "Error message", maxLength = 4000)
    private String error;

    @Size(max = 1000, message = "reportPath length must be at most 1000")
    @Schema(description = "Legacy report path", maxLength = 1000)
    private String reportPath;

    @Size(max = 1000, message = "reportUrl length must be at most 1000")
    @Schema(description = "Report URL", maxLength = 1000)
    private String reportUrl;

    @Size(max = 1000, message = "logs size must be at most 1000")
    @Schema(description = "Execution logs")
    private List<@Size(max = 4000, message = "log line length must be at most 4000") String> logs;

    @Schema(description = "Execution duration in milliseconds")
    private Long duration;

    @Schema(description = "Structured execution result")
    private Map<String, Object> result;
}
