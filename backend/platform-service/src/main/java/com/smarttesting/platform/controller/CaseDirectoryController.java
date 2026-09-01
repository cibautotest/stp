package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.CaseDirectory;
import com.smarttesting.platform.service.CaseDirectoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.validation.Valid;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/platform/case-directories")
@Tag(name = "Case Directories", description = "Test case directory management APIs")
@Validated
public class CaseDirectoryController {

    @Resource
    private CaseDirectoryService caseDirectoryService;

    @Operation(summary = "List case directories by project")
    @GetMapping
    public List<CaseDirectory> list(@Size(max = 64) @RequestParam String projectId) {
        return caseDirectoryService.listByProject(projectId);
    }

    @Operation(summary = "Create a case directory")
    @PostMapping
    public ResponseEntity<?> create(@Valid @RequestBody CaseDirectory directory) {
        if (directory.getParentId() != null && !directory.getParentId().isBlank()) {
            CaseDirectory parent = caseDirectoryService.getById(directory.getParentId());
            if (parent == null || !directory.getProjectId().equals(parent.getProjectId())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid parent directory"));
            }
        }
        directory.setParentId(directory.getParentId() == null || directory.getParentId().isBlank() ? null : directory.getParentId());
        caseDirectoryService.save(directory);
        return ResponseEntity.status(HttpStatus.CREATED).body(directory);
    }

    @Operation(summary = "Delete a case directory")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Size(max = 64) @PathVariable String id) {
        try {
            caseDirectoryService.deleteDirectory(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
