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
@Schema(description = "Test plan")
@TableName("test_plans")
public class TestPlan {

    @TableId(type = IdType.ASSIGN_ID)
    @Size(max = 64, message = "id length must be at most 64")
    @Schema(description = "Plan ID", example = "1234567890", maxLength = 64)
    private String id;

    @NotBlank(message = "projectId is required")
    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", example = "proj-001", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String projectId;

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Plan name", example = "Regression test plan", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @Size(max = 1000, message = "description length must be at most 1000")
    @Schema(description = "Plan description", maxLength = 1000)
    private String description;

    @Pattern(regexp = "ACTIVE|ARCHIVED|active|archived", message = "status must be ACTIVE or ARCHIVED")
    @Schema(description = "Status", example = "ACTIVE", allowableValues = {"ACTIVE", "ARCHIVED"})
    private String status;

    @Schema(description = "Creator user ID", example = "1")
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "Created time")
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "Updated time")
    private LocalDateTime updatedAt;

    @TableLogic
    @Schema(description = "Logic deleted flag", hidden = true)
    private Integer deleted;

    @Schema(description = "Last executed time")
    private LocalDateTime lastExecutedAt;

    @Pattern(regexp = "PASSED|FAILED|N_FAILED|passed|failed|n_failed", message = "lastExecutionResult is invalid")
    @Schema(description = "Last execution result", example = "PASSED", allowableValues = {"PASSED", "FAILED", "N_FAILED"})
    private String lastExecutionResult;

    @Size(max = 128, message = "lastBatchId length must be at most 128")
    @Schema(description = "Last batch ID", maxLength = 128)
    private String lastBatchId;
}
