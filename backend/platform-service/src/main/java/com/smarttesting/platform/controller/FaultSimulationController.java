package com.smarttesting.platform.controller;

import com.smarttesting.platform.model.FaultSimulationRequest;
import com.smarttesting.platform.model.FaultSimulationResponse;
import com.smarttesting.platform.service.FaultSimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import javax.validation.Valid;
import javax.validation.constraints.Pattern;
import java.util.Map;

@Tag(name = "Fault Simulation", description = "Trigger controlled backend failures for observability and root-cause analysis")
@RestController
@RequestMapping("/api/platform/fault-simulation")
@Validated
public class FaultSimulationController {

    private static final Logger log = LoggerFactory.getLogger(FaultSimulationController.class);

    private final FaultSimulationService faultSimulationService;

    public FaultSimulationController(FaultSimulationService faultSimulationService) {
        this.faultSimulationService = faultSimulationService;
    }

    @Operation(summary = "Trigger a fault simulation scenario")
    @PostMapping("/{scenario}")
    public ResponseEntity<FaultSimulationResponse> trigger(
            @Pattern(regexp = "sql-primary-key-conflict|null-pointer|message-parse-failure", message = "scenario is invalid") @PathVariable String scenario,
            @Valid @RequestBody(required = false) FaultSimulationRequest request) {
        FaultSimulationRequest safeRequest = request == null ? new FaultSimulationRequest() : request;
        String simulationId = faultSimulationService.createSimulationId();
        log.info("[FaultSimulation] request accepted, simulationId={}, scenario={}, projectId={}, note={}",
                simulationId, scenario, safeRequest.getProjectId(), safeRequest.getNote());

        switch (scenario) {
            case "sql-primary-key-conflict":
                faultSimulationService.simulatePrimaryKeyConflict(simulationId, safeRequest);
                break;
            case "null-pointer":
                faultSimulationService.simulateNullPointer(simulationId, safeRequest);
                break;
            case "message-parse-failure":
                faultSimulationService.simulateMessageParseFailure(simulationId, safeRequest);
                break;
            default:
                log.warn("[FaultSimulation] unsupported scenario, simulationId={}, scenario={}", simulationId, scenario);
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unsupported fault simulation scenario: " + scenario);
        }

        return ResponseEntity.ok(new FaultSimulationResponse(simulationId, scenario, "Scenario completed without failure"));
    }

    @Operation(summary = "Health check for the fault simulation feature")
    @PostMapping("/health")
    public Map<String, Object> health() {
        return Map.of("success", true, "feature", "fault-simulation");
    }
}
