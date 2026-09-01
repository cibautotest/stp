package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
import java.util.List;

@Data
@Schema(description = "Case ID list request")
public class CaseIdsRequest {

    @NotEmpty(message = "caseIds is required")
    @Size(max = 200, message = "caseIds size must be at most 200")
    @Schema(description = "Case ID list", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<@Size(max = 64, message = "caseId length must be at most 64") String> caseIds;
}
