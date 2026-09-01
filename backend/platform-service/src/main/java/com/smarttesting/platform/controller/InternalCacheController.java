package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.service.TestCaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import javax.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/platform/internal/caches")
@Tag(name = "Internal Caches", description = "Internal test case cache upload APIs")
@Validated
public class InternalCacheController {
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");
    @Value("${reports.upload-token}") private String uploadToken;
    @Value("${reports.max-upload-size:52428800}") private long maxUploadSize;
    @Resource private TestCaseService testCaseService;

    @Operation(summary = "Upload test case cache content")
    @PutMapping(value = "/{caseId}", consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<?> upload(@Size(max = 64) @PathVariable String caseId,
            @RequestHeader(value = "X-Report-Upload-Token", required = false) String token,
            @RequestBody byte[] content) {
        if (!ID.matcher(caseId).matches()) return ResponseEntity.badRequest().body(Map.of("error", "Invalid case ID"));
        if (!uploadToken.equals(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid upload token"));
        if (content.length > maxUploadSize) return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "Invalid cache size"));
        TestCase testCase = testCaseService.getById(caseId);
        if (testCase == null) return ResponseEntity.notFound().build();
        testCase.setCacheContent(new String(content, StandardCharsets.UTF_8));
        testCaseService.updateById(testCase);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
