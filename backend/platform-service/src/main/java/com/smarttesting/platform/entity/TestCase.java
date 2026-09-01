package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
@Schema(description = "Test case")
@TableName("test_cases")
public class TestCase {

    @TableId(type = IdType.ASSIGN_ID)
    @Size(max = 64, message = "id length must be at most 64")
    @Schema(description = "Case ID", maxLength = 64)
    private String id;

    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", maxLength = 64)
    private String projectId;

    @NotBlank(message = "directoryId is required")
    @Size(max = 64, message = "directoryId length must be at most 64")
    @Schema(description = "Directory ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String directoryId;

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Case name", example = "Baidu search test", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @Size(max = 1000, message = "description length must be at most 1000")
    @Schema(description = "Case description", maxLength = 1000)
    private String description;

    @NotBlank(message = "nlp is required")
    @Size(max = 20000, message = "nlp length must be at most 20000")
    @Schema(description = "Natural-language test instruction", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 20000)
    private String nlp;

    @Size(max = 200000, message = "yamlFlow length must be at most 200000")
    @Schema(description = "YAML flow definition", maxLength = 200000)
    private String yamlFlow;

    @Pattern(regexp = "NLP|YAML|nlp|yaml", message = "executionMode must be NLP or YAML")
    @Schema(description = "Execution mode", allowableValues = {"NLP", "YAML"})
    private String executionMode;

    @Size(max = 200000, message = "script length must be at most 200000")
    @Schema(description = "Generated test script", maxLength = 200000)
    private String script;

    @Size(max = 1000, message = "url length must be at most 1000")
    @Schema(description = "Target page URL", maxLength = 1000)
    private String url;

    @Pattern(regexp = "PENDING|RUNNING|SUCCESS|FAILED|PASSED|ERROR|CANCELLED|pending|running|success|failed|passed|error|cancelled", message = "status is invalid")
    @Schema(description = "Execution status", example = "PENDING", allowableValues = {"PENDING", "RUNNING", "SUCCESS", "FAILED", "PASSED", "ERROR", "CANCELLED"})
    private String status;

    @Size(max = 20000, message = "aiConfigSnapshot length must be at most 20000")
    @Schema(description = "AI configuration snapshot", maxLength = 20000)
    private String aiConfigSnapshot;

    @Schema(description = "Last executed time")
    private LocalDateTime executedAt;

    @Schema(description = "Report generated time")
    private LocalDateTime reportGeneratedAt;

    @Size(max = 1000, message = "htmlReportPath length must be at most 1000")
    @Schema(description = "HTML report path", maxLength = 1000)
    private String htmlReportPath;

    @Size(max = 1000, message = "fullReportPath length must be at most 1000")
    @Schema(description = "Full report path", maxLength = 1000)
    private String fullReportPath;

    @Size(max = 500000, message = "cacheContent length must be at most 500000")
    @Schema(description = "Midscene UI cache content", maxLength = 500000)
    private String cacheContent;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "Created time")
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "Updated time")
    private LocalDateTime updatedAt;

    @TableLogic
    @Schema(description = "Logic deleted flag", hidden = true)
    private Integer deleted;
}
