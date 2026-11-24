package com.smarttesting.platform.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

import com.smarttesting.platform.entity.LoginMethod;
import com.smarttesting.platform.service.LoginMethodService;

import javax.annotation.Resource;
import javax.validation.Valid;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform/login-methods")
@Tag(name = "Login Methods", description = "Reusable login method APIs")
@Validated
public class LoginMethodController {

    @Resource
    private LoginMethodService loginMethodService;

    @Operation(summary = "List login methods by project")
    @GetMapping
    public List<LoginMethod> list(@Size(max = 64) @RequestParam String projectId) {
        return loginMethodService.listByProject(projectId);
    }

    @Operation(summary = "Create a login method")
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody LoginMethod method) {
        try {
            loginMethodService.createMethod(method);
            return ResponseEntity.status(HttpStatus.CREATED).body(method);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Update a login method")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@Size(max = 64) @PathVariable String id, @Valid @RequestBody LoginMethod method) {
        method.setId(id);
        loginMethodService.updateMethod(method);
        return ResponseEntity.ok(method);
    }

    @Operation(summary = "Update cache status (called by execute-service)")
    @PutMapping("/{id}/cache-status")
    public ResponseEntity<?> updateCacheStatus(@Size(max = 64) @PathVariable String id,
                                               @RequestBody Map<String, String> body) {
        try {
            loginMethodService.updateCacheStatus(id, body.get("status"));
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Delete a login method")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Size(max = 64) @PathVariable String id) {
        try {
            loginMethodService.deleteMethod(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
