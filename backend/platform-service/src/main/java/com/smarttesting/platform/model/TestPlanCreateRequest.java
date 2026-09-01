package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.util.List;

@Data
@Schema(description = "Create test plan request")
public class TestPlanCreateRequest {

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Plan name", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @NotBlank(message = "projectId is required")
    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String projectId;

    @Size(max = 1000, message = "description length must be at most 1000")
    @Schema(description = "Plan description", maxLength = 1000)
    private String description;

    @Size(max = 200, message = "caseIds size must be at most 200")
    @Schema(description = "Case IDs to attach to this plan")
    private List<@Size(max = 64, message = "caseId length must be at most 64") String> caseIds;
}
