package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
@Schema(description = "Fault simulation trigger response")
public class FaultSimulationResponse {

    @Schema(description = "Generated simulation ID")
    private String simulationId;

    @Schema(description = "Scenario code")
    private String scenario;

    @Schema(description = "Trigger result message")
    private String message;
}
