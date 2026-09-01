package com.smarttesting.platform.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.model.PageResult;
import com.smarttesting.platform.service.ProjectService;
import com.smarttesting.platform.service.UserService;
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
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Size;
import java.util.Map;

@Tag(name = "Projects", description = "Project CRUD and search APIs")
@RestController
@RequestMapping("/api/platform/projects")
@Validated
public class ProjectController {

    @Resource
    private ProjectService projectService;

    @Resource
    private UserService userService;

    @Operation(summary = "List projects")
    @GetMapping
    public ResponseEntity<PageResult<Project>> list(
            @Parameter(description = "Project name keyword", schema = @Schema(maxLength = 100)) @Size(max = 100) @RequestParam(required = false) String name,
            @Parameter(description = "Page number", schema = @Schema(minimum = "1")) @Min(1) @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Page size", schema = @Schema(minimum = "1", maximum = "100")) @Min(1) @Max(100) @RequestParam(defaultValue = "10") int size,
            Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        String role = authentication != null ?
                authentication.getAuthorities().stream().findFirst()
                        .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                        .orElse("general") : "general";

        IPage<Project> result = projectService.listByName(name, page, size, userId, role);
        return ResponseEntity.ok(PageResult.of(
                result.getTotal(),
                result.getCurrent(),
                result.getSize(),
                result.getRecords()));
    }

    @Operation(summary = "Get project detail")
    @GetMapping("/{id}")
    public ResponseEntity<Project> getById(@Parameter(description = "Project ID") @Size(max = 64) @PathVariable String id) {
        Project project = projectService.getById(id);
        if (project == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(project);
    }

    @Operation(summary = "Create project", description = "If the name already exists, returns the existing project and grants current user access.")
    @PostMapping
    public ResponseEntity<?> create(@Parameter(description = "Project payload") @Valid @RequestBody Project project,
                                    Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;

        if (projectService.isNameExists(project.getName())) {
            Project existing = projectService.findByName(project.getName());
            if (existing != null) {
                if (userId != null) {
                    userService.assignProjectToUser(userId, existing.getId());
                }
                return ResponseEntity.ok(existing);
            }
        }

        projectService.createProject(project, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(project);
    }

    @Operation(summary = "Update project")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@Parameter(description = "Project ID") @Size(max = 64) @PathVariable String id,
                                    @Parameter(description = "Project payload") @Valid @RequestBody Project project) {
        Project existing = projectService.getById(id);
        if (existing == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Project not found"));
        }
        if (project.getName() != null && !project.getName().equals(existing.getName())
                && projectService.isNameExists(project.getName(), id)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Project name already exists"));
        }
        project.setId(id);
        projectService.updateById(project);
        return ResponseEntity.ok(projectService.getById(id));
    }

    @Operation(summary = "Delete project", description = "Delete project and its associated cases.")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Parameter(description = "Project ID") @Size(max = 64) @PathVariable String id) {
        if (projectService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Project not found"));
        }
        projectService.deleteWithCases(id);
        return ResponseEntity.noContent().build();
    }
}
