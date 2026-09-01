package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.entity.TestPlan;
import com.smarttesting.platform.model.CaseIdsRequest;
import com.smarttesting.platform.model.TestPlanCreateRequest;
import com.smarttesting.platform.service.ExecuteServiceUrlResolver;
import com.smarttesting.platform.service.PlanExecutionService;
import com.smarttesting.platform.service.TestPlanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.validation.Valid;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@Tag(name = "Test Plans", description = "Test plan CRUD, case assignment and execution APIs")
@RestController
@RequestMapping("/api/platform/plans")
@Validated
public class TestPlanController {

    @Resource
    private TestPlanService testPlanService;

    @Resource
    private PlanExecutionService planExecutionService;

    @Resource
    private ExecuteServiceUrlResolver executeServiceUrlResolver;

    @Operation(summary = "List test plans")
    @GetMapping
    public ResponseEntity<List<TestPlan>> list(
            @Parameter(description = "Project ID filter", schema = @Schema(maxLength = 64)) @Size(max = 64) @RequestParam(required = false) String projectId,
            Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        String role = authentication != null ?
                authentication.getAuthorities().stream().findFirst()
                        .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                        .orElse("general") : "general";

        if (projectId != null && !projectId.isBlank()) {
            return ResponseEntity.ok(testPlanService.listByProject(projectId, userId, role));
        }
        return ResponseEntity.ok(testPlanService.listWithAuth(userId, role));
    }

    @Operation(summary = "Get test plan detail")
    @GetMapping("/{id}")
    public ResponseEntity<TestPlan> getById(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id) {
        TestPlan plan = testPlanService.getById(id);
        if (plan == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(plan);
    }

    @Operation(summary = "Create test plan", description = "Create a plan and optionally attach cases.")
    @PostMapping
    public ResponseEntity<?> create(@Parameter(description = "Plan payload") @Valid @RequestBody TestPlanCreateRequest body,
                                    Authentication authentication) {
        TestPlan plan = new TestPlan();
        plan.setName(body.getName());
        plan.setProjectId(body.getProjectId());
        plan.setDescription(body.getDescription() != null ? body.getDescription() : "");

        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        TestPlan created = testPlanService.createPlan(plan, body.getCaseIds(), userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @Operation(summary = "Update test plan")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id,
                                    @Parameter(description = "Plan payload") @Valid @RequestBody TestPlan plan) {
        TestPlan existing = testPlanService.getById(id);
        if (existing == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Plan not found"));
        }
        plan.setId(id);
        testPlanService.updateById(plan);
        return ResponseEntity.ok(testPlanService.getById(id));
    }

    @Operation(summary = "Delete test plan")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id) {
        if (testPlanService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Plan not found"));
        }
        testPlanService.removeById(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "List cases in test plan")
    @GetMapping("/{id}/cases")
    public ResponseEntity<List<TestCase>> getPlanCases(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id) {
        if (testPlanService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(testPlanService.getPlanCases(id));
    }

    @Operation(summary = "Add cases to test plan")
    @PostMapping("/{id}/cases")
    public ResponseEntity<?> addCasesToPlan(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id,
                                            @Parameter(description = "Case ID list") @Valid @RequestBody CaseIdsRequest body) {
        if (testPlanService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Plan not found"));
        }
        int added = testPlanService.addCasesToPlan(id, body.getCaseIds());
        return ResponseEntity.ok(Map.of("added", added));
    }

    @Operation(summary = "Remove case from test plan")
    @DeleteMapping("/{id}/cases/{caseId}")
    public ResponseEntity<?> removeCaseFromPlan(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id,
                                                @Parameter(description = "Case ID") @Size(max = 64) @PathVariable String caseId) {
        if (testPlanService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Plan not found"));
        }
        boolean removed = testPlanService.removeCaseFromPlan(id, caseId);
        if (!removed) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Case is not in the plan"));
        }
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Execute test plan", description = "Execute all cases in the plan in order and return batchId.")
    @PostMapping("/{id}/execute")
    public ResponseEntity<?> executePlan(@Parameter(description = "Plan ID") @Size(max = 64) @PathVariable String id,
                                         Authentication authentication) {
        TestPlan plan = testPlanService.getById(id);
        if (plan == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Plan not found"));
        }

        int caseCount = testPlanService.getPlanCaseCount(id);
        if (caseCount == 0) {
            return ResponseEntity.badRequest().body(Map.of("error", "Plan has no cases"));
        }

        String batchId = PlanExecutionService.generateBatchId();
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        try {
            executeServiceUrlResolver.resolve(userId, plan.getProjectId());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
        planExecutionService.executePlanAsync(id, batchId, userId);

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("batchId", batchId, "totalCases", caseCount,
                        "message", "Plan execution submitted"));
    }
}
