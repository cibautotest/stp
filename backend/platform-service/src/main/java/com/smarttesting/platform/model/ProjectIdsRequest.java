package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.util.List;

@Data
@Schema(description = "Project ID list request")
public class ProjectIdsRequest {

    @NotNull(message = "projectIds is required")
    @Size(max = 200, message = "projectIds size must be at most 200")
    @Schema(description = "Project ID list", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<@Size(max = 64, message = "projectId length must be at most 64") String> projectIds;
}
