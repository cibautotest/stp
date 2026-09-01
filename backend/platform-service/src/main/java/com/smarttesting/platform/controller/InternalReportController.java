package com.smarttesting.platform.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.regex.Pattern;
import javax.validation.constraints.Size;

/** Internal endpoint used by execution machines to hand completed reports back to the platform. */
@RestController
@RequestMapping("/api/platform/internal/reports")
@Tag(name = "Internal Reports", description = "Internal report upload APIs")
@Validated
public class InternalReportController {

    private static final Pattern EXECUTION_ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");

    @Value("${reports.storage-directory:./data/reports}")
    private String storageDirectory;

    @Value("${reports.upload-token}")
    private String uploadToken;

    @Value("${reports.max-upload-size:52428800}")
    private long maxUploadSize;

    @Operation(summary = "Upload execution report HTML")
    @PutMapping(value = "/{executionId}", consumes = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<?> upload(
            @Size(max = 128) @PathVariable String executionId,
            @RequestHeader(value = "X-Report-Upload-Token", required = false) String token,
            @RequestBody byte[] content) throws IOException {
        if (!EXECUTION_ID.matcher(executionId).matches()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid execution ID"));
        }
        if (!uploadToken.equals(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid report upload token"));
        }
        if (content.length == 0 || content.length > maxUploadSize) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "Invalid report size"));
        }

        Path directory = Path.of(storageDirectory).toAbsolutePath().normalize();
        Files.createDirectories(directory);
        Path target = directory.resolve(executionId + ".html").normalize();
        if (!target.startsWith(directory)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid execution ID"));
        }
        Path temporary = Files.createTempFile(directory, executionId + "-", ".upload");
        try {
            Files.write(temporary, content);
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
        return ResponseEntity.ok(Map.of("reportUrl", "/api/platform/reports/content/" + executionId));
    }
}
