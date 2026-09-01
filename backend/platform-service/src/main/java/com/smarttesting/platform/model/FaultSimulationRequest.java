package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Size;

@Data
@Schema(description = "Fault simulation trigger request")
public class FaultSimulationRequest {

    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID used by the UI when triggering the fault", maxLength = 64)
    private String projectId;

    @Size(max = 1000, message = "note length must be at most 1000")
    @Schema(description = "Optional operator note for log correlation", maxLength = 1000)
    private String note;
}
