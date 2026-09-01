package com.smarttesting.platform.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.entity.User;
import com.smarttesting.platform.model.ChangePasswordRequest;
import com.smarttesting.platform.model.PageResult;
import com.smarttesting.platform.model.PasswordResetRequest;
import com.smarttesting.platform.model.ProjectIdsRequest;
import com.smarttesting.platform.model.UserCreateRequest;
import com.smarttesting.platform.model.UserUpdateRequest;
import com.smarttesting.platform.service.ProjectService;
import com.smarttesting.platform.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
import javax.validation.constraints.Positive;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@Tag(name = "Users", description = "User CRUD, password reset and project permission APIs")
@RestController
@RequestMapping("/api/platform/users")
@Validated
public class UserController {

    @Resource
    private UserService userService;

    @Resource
    private ProjectService projectService;

    @Operation(summary = "List users")
    @PreAuthorize("hasRole('SYSADMIN')")
    @GetMapping
    public ResponseEntity<PageResult<User>> list(
            @Parameter(description = "Page number", schema = @Schema(minimum = "1")) @Min(1) @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "Page size", schema = @Schema(minimum = "1", maximum = "100")) @Min(1) @Max(100) @RequestParam(defaultValue = "10") int size,
            @Parameter(description = "Username keyword", schema = @Schema(maxLength = 50)) @Size(max = 50) @RequestParam(required = false) String username) {
        IPage<User> result = userService.lambdaQuery()
                .like(username != null && !username.isBlank(), User::getUsername, username)
                .eq(User::getDeleted, 0)
                .orderByDesc(User::getCreatedAt)
                .page(new Page<>(page, size));
        result.getRecords().forEach(u -> u.setPassword(null));
        return ResponseEntity.ok(PageResult.of(
                result.getTotal(),
                result.getCurrent(),
                result.getSize(),
                result.getRecords()));
    }

    @Operation(summary = "Get user detail")
    @PreAuthorize("hasRole('SYSADMIN')")
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@Positive @PathVariable Long id) {
        User user = userService.getById(id);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }
        user.setPassword(null);
        return ResponseEntity.ok(user);
    }

    @Operation(summary = "Create user")
    @PreAuthorize("hasRole('SYSADMIN')")
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody UserCreateRequest body) {
        if (userService.getByUsername(body.getUsername()) != null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "Username already exists"));
        }

        String role = body.getRole();
        if (role == null || role.isBlank()) {
            role = "general";
        }

        User user = new User();
        user.setUsername(body.getUsername());
        user.setDisplayName(body.getDisplayName() != null ? body.getDisplayName() : body.getUsername());
        user.setRole(role);
        user.setStatus(body.getStatus() != null ? body.getStatus() : 1);
        user.setExecuteServiceUrl(body.getExecuteServiceUrl());

        userService.createUser(user, body.getPassword());
        user.setPassword(null);

        return ResponseEntity.status(HttpStatus.CREATED).body(user);
    }

    @Operation(summary = "Update user")
    @PreAuthorize("hasRole('SYSADMIN')")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@Positive @PathVariable Long id, @Valid @RequestBody UserUpdateRequest body) {
        User existing = userService.getById(id);
        if (existing == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }

        if (body.getDisplayName() != null) {
            existing.setDisplayName(body.getDisplayName());
        }
        if (body.getRole() != null) {
            existing.setRole(body.getRole());
        }
        if (body.getStatus() != null) {
            existing.setStatus(body.getStatus());
        }
        if (body.getExecuteServiceUrl() != null) {
            existing.setExecuteServiceUrl(body.getExecuteServiceUrl().trim());
        }

        userService.updateById(existing);
        existing.setPassword(null);
        return ResponseEntity.ok(existing);
    }

    @Operation(summary = "Reset user password")
    @PreAuthorize("hasRole('SYSADMIN')")
    @PutMapping("/{id}/password")
    public ResponseEntity<?> resetPassword(@Positive @PathVariable Long id, @Valid @RequestBody PasswordResetRequest body) {
        boolean ok = userService.updatePassword(id, body.getPassword());
        if (!ok) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }
        return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
    }

    @Operation(summary = "Change current user password")
    @PutMapping("/me/password")
    public ResponseEntity<?> changeMyPassword(Authentication authentication, @Valid @RequestBody ChangePasswordRequest body) {
        if (authentication == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized"));
        }

        Long userId = (Long) authentication.getPrincipal();
        try {
            boolean ok = userService.changePassword(userId, body.getOldPassword(), body.getNewPassword());
            if (!ok) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
            }
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
        return ResponseEntity.ok(Map.of("message", "Password changed successfully"));
    }

    @Operation(summary = "Delete user")
    @PreAuthorize("hasRole('SYSADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Positive @PathVariable Long id) {
        if (userService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
        }
        userService.removeById(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get assigned projects for user")
    @PreAuthorize("hasRole('SYSADMIN')")
    @GetMapping("/{id}/projects")
    public ResponseEntity<?> getUserProjects(@Positive @PathVariable Long id) {
        List<String> projectIds = userService.getAssignedProjectIds(id);
        return ResponseEntity.ok(Map.of("projectIds", projectIds));
    }

    @Operation(summary = "Assign user projects", description = "Full replacement of accessible project IDs")
    @PreAuthorize("hasRole('SYSADMIN')")
    @PutMapping("/{id}/projects")
    public ResponseEntity<?> assignProjects(@Positive @PathVariable Long id, @Valid @RequestBody ProjectIdsRequest body) {
        userService.assignProjects(id, body.getProjectIds());
        return ResponseEntity.ok(Map.of("message", "Permissions assigned successfully"));
    }

    @Operation(summary = "List all projects for permission assignment")
    @PreAuthorize("hasRole('SYSADMIN')")
    @GetMapping("/all-projects")
    public ResponseEntity<List<Project>> getAllProjects() {
        List<Project> projects = projectService.lambdaQuery()
                .eq(Project::getDeleted, 0)
                .orderByAsc(Project::getName)
                .list();
        return ResponseEntity.ok(projects);
    }
}
