package com.smarttesting.platform.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.model.PageResult;
import com.smarttesting.platform.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Positive;
import javax.validation.constraints.Size;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Tag(name = "Reports", description = "Test report query and delete APIs")
@RestController
@RequestMapping("/api/platform/reports")
@Validated
public class ReportController {

    private static final Logger log = LoggerFactory.getLogger(ReportController.class);
    private static final Pattern EXECUTION_ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");

    @Resource
    private ReportService reportService;

    @org.springframework.beans.factory.annotation.Value("${reports.storage-directory:./data/reports}")
    private String storageDirectory;

    @Operation(summary = "Get archived HTML report")
    @PreAuthorize("isAuthenticated()")
    @GetMapping(value = "/content/{executionId}", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<?> content(
            @Parameter(description = "Execution ID", schema = @Schema(maxLength = 128)) @Size(max = 128) @PathVariable String executionId,
            Authentication authentication) {
        if (!EXECUTION_ID.matcher(executionId).matches()) {
            return ResponseEntity.badRequest().body("Invalid execution ID");
        }
        if (!canAccessExecutionReport(authentication, executionId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Forbidden");
        }
        try {
            Path directory = Path.of(storageDirectory).toAbsolutePath().normalize();
            Path report = directory.resolve(executionId + ".html").normalize();
            if (!report.startsWith(directory) || !Files.isRegularFile(report)) {
                log.warn("Archived report file not found: executionId={}, storageDirectory={}, resolvedPath={}",
                        executionId, directory, report);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Report not found");
            }
            return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(Files.readString(report));
        } catch (Exception e) {
            log.error("Unable to read archived report: executionId={}, storageDirectory={}", executionId, storageDirectory, e);
            return ResponseEntity.internalServerError().body("Unable to read report");
        }
    }

    @Operation(summary = "List reports")
    @GetMapping
    public ResponseEntity<PageResult<Report>> list(
            @Parameter(description = "Page number", schema = @Schema(minimum = "1")) @Min(1) @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Page size", schema = @Schema(minimum = "1", maximum = "100")) @Min(1) @Max(100) @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Project ID", schema = @Schema(maxLength = 64)) @Size(max = 64) @RequestParam(required = false) String projectId,
            @Parameter(description = "Directory ID", schema = @Schema(maxLength = 64)) @Size(max = 64) @RequestParam(required = false) String directoryId,
            Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        String role = authentication != null ?
                authentication.getAuthorities().stream().findFirst()
                        .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                        .orElse("general") : "general";

        IPage<Report> result = reportService.pageReports(page, size, userId, role, projectId, directoryId);
        return ResponseEntity.ok(PageResult.of(
                result.getTotal(),
                result.getCurrent(),
                result.getSize(),
                result.getRecords()));
    }

    @Operation(summary = "Get latest report")
    @GetMapping("/latest")
    public ResponseEntity<?> getLatest(Authentication authentication) {
        Long userId = getUserId(authentication);
        String role = getRole(authentication);
        IPage<Report> latestPage = reportService.pageReports(1, 1, userId, role, null, null);
        Report report = latestPage.getRecords().isEmpty() ? null : latestPage.getRecords().get(0);
        if (report == null) {
            return ResponseEntity.ok(Map.of("htmlReportPath", (Object) null, "reportName", (Object) null));
        }
        return ResponseEntity.ok(Map.of(
                "htmlReportPath", report.getResult() != null ? report.getResult() : "",
                "reportName", report.getName(),
                "caseId", report.getCaseId(),
                "status", report.getStatus()
        ));
    }

    @Operation(summary = "Get report by case ID")
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{caseId}")
    public ResponseEntity<?> getByCaseId(
            @Parameter(description = "Case ID", schema = @Schema(maxLength = 64)) @Size(max = 64) @PathVariable String caseId,
            Authentication authentication) {
        Report report = reportService.getByCaseId(caseId);
        if (report == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Report not found"));
        }
        if (!canAccessReport(authentication, report)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Forbidden"));
        }
        return ResponseEntity.ok(report);
    }

    @Operation(summary = "Delete report")
    @PreAuthorize("hasRole('SYSADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Parameter(description = "Report ID", schema = @Schema(minimum = "1")) @Positive @PathVariable Long id) {
        boolean deleted = reportService.deleteReport(id);
        if (!deleted) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Report not found"));
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    private boolean canAccessExecutionReport(Authentication authentication, String executionId) {
        return reportService.lambdaQuery()
                .likeRight(Report::getResult, "/api/platform/reports/content/")
                .list()
                .stream()
                .filter(report -> report.getResult() != null && report.getResult().endsWith("/" + executionId))
                .anyMatch(report -> canAccessReport(authentication, report));
    }

    private boolean canAccessReport(Authentication authentication, Report report) {
        if (report == null || authentication == null) return false;
        String role = getRole(authentication);
        if ("sysadmin".equals(role)) return true;
        Long userId = getUserId(authentication);
        if (userId == null || report.getProjectId() == null) return false;
        return reportService.canAccessReport(report, userId, role);
    }

    private Long getUserId(Authentication authentication) {
        return authentication != null ? (Long) authentication.getPrincipal() : null;
    }

    private String getRole(Authentication authentication) {
        return authentication != null ?
                authentication.getAuthorities().stream().findFirst()
                        .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                        .orElse("general") : "general";
    }
}
