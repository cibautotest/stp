package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.model.ActionStep;
import com.smarttesting.platform.model.IdsRequest;
import com.smarttesting.platform.model.NlpRequest;
import com.smarttesting.platform.service.TestCaseService;
import com.smarttesting.platform.service.YamlGeneratorService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.annotation.Resource;
import javax.validation.Valid;
import javax.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Tag(name = "Test Cases", description = "Test case CRUD, generation and batch operation APIs")
@RestController
@RequestMapping("/api/platform/cases")
@Validated
public class TestCaseController {

    private static final Logger log = LoggerFactory.getLogger(TestCaseController.class);

    @Resource
    private TestCaseService testCaseService;

    @Resource
    private YamlGeneratorService yamlGeneratorService;

    @Operation(summary = "List test cases")
    @GetMapping
    public ResponseEntity<List<TestCase>> list(
            @Parameter(description = "Project ID filter", schema = @Schema(maxLength = 64)) @Size(max = 64) @RequestParam(required = false) String projectId,
            Authentication authentication) {
        Long userId = authentication != null ? (Long) authentication.getPrincipal() : null;
        String role = authentication != null ?
                authentication.getAuthorities().stream().findFirst()
                        .map(a -> a.getAuthority().replace("ROLE_", "").toLowerCase())
                        .orElse("general") : "general";

        if (projectId != null && !projectId.isBlank()) {
            return ResponseEntity.ok(testCaseService.listByProjectId(projectId, userId, role));
        }
        return ResponseEntity.ok(testCaseService.listWithAuth(userId, role));
    }

    @Operation(summary = "Get test case detail")
    @GetMapping("/{id}")
    public ResponseEntity<TestCase> getById(@Parameter(description = "Case ID") @Size(max = 64) @PathVariable String id) {
        TestCase testCase = testCaseService.getById(id);
        if (testCase == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(testCase);
    }

    @Operation(summary = "Get test case cache")
    @GetMapping(value = "/{id}/cache", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getCache(@Size(max = 64) @PathVariable String id) {
        TestCase testCase = testCaseService.getById(id);
        if (testCase == null || testCase.getCacheContent() == null || testCase.getCacheContent().isBlank()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(testCase.getCacheContent());
    }

    @Operation(summary = "Create test case")
    @PostMapping
    public ResponseEntity<?> create(@Parameter(description = "Case payload") @Valid @RequestBody TestCase testCase) {
        testCase.setStatus("PENDING");
        testCase.setDeleted(0);
        testCaseService.save(testCase);
        return ResponseEntity.status(HttpStatus.CREATED).body(testCase);
    }

    @Operation(summary = "Update test case")
    @PutMapping("/{id}")
    public ResponseEntity<?> update(@Parameter(description = "Case ID") @Size(max = 64) @PathVariable String id,
                                    @Parameter(description = "Case payload") @RequestBody TestCase testCase) {
        TestCase existing = testCaseService.getById(id);
        if (existing == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Test case not found"));
        }

        if (testCase.getProjectId() != null) existing.setProjectId(testCase.getProjectId());
        if (testCase.getDirectoryId() != null) existing.setDirectoryId(testCase.getDirectoryId());
        if (testCase.getName() != null) existing.setName(testCase.getName());
        if (testCase.getDescription() != null) existing.setDescription(testCase.getDescription());
        if (testCase.getNlp() != null) existing.setNlp(testCase.getNlp());
        if (testCase.getYamlFlow() != null) existing.setYamlFlow(testCase.getYamlFlow());
        if (testCase.getExecutionMode() != null) existing.setExecutionMode(testCase.getExecutionMode());
        if (testCase.getScript() != null) existing.setScript(testCase.getScript());
        if (testCase.getUrl() != null) existing.setUrl(testCase.getUrl());
        if (testCase.getStatus() != null) existing.setStatus(testCase.getStatus());
        if (testCase.getAiConfigSnapshot() != null) existing.setAiConfigSnapshot(testCase.getAiConfigSnapshot());
        if (testCase.getHtmlReportPath() != null) existing.setHtmlReportPath(testCase.getHtmlReportPath());
        if (testCase.getFullReportPath() != null) existing.setFullReportPath(testCase.getFullReportPath());
        if (testCase.getCacheContent() != null) existing.setCacheContent(testCase.getCacheContent());

        testCaseService.updateById(existing);
        return ResponseEntity.ok(testCaseService.getById(id));
    }

    @Operation(summary = "Delete test case")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@Parameter(description = "Case ID") @Size(max = 64) @PathVariable String id) {
        if (testCaseService.getById(id) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Test case not found"));
        }
        testCaseService.removeById(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Convert NLP to action steps")
    @PostMapping("/nlp-to-actions")
    public ResponseEntity<?> nlpToActions(@Valid @RequestBody NlpRequest body) {
        try {
            List<ActionStep> steps = yamlGeneratorService.nlpToActions(body.getNlp().trim());
            return ResponseEntity.ok(steps);
        } catch (RuntimeException e) {
            log.error("[TestCase] Failed to convert NLP to actions", e);
            return ResponseEntity.internalServerError().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Stream YAML generation")
    @PostMapping(value = "/nlp-to-yaml/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> nlpToYamlStream(@Valid @RequestBody NlpRequest body) {
        SseEmitter emitter = new SseEmitter(0L);
        String nlp = body.getNlp();
        HttpHeaders headers = new HttpHeaders();
        headers.setCacheControl("no-cache, no-transform");
        headers.set("X-Accel-Buffering", "no");
        headers.set("Connection", "keep-alive");

        ScheduledExecutorService heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread thread = new Thread(r, "yaml-generation-heartbeat");
            thread.setDaemon(true);
            return thread;
        });
        try {
            emitter.send(SseEmitter.event().name("started").data("AI generation started"));
        } catch (Exception e) {
            heartbeatExecutor.shutdownNow();
            emitter.completeWithError(e);
            return ResponseEntity.internalServerError().headers(headers).body(emitter);
        }
        ScheduledFuture<?> heartbeat = heartbeatExecutor.scheduleAtFixedRate(() -> {
            try {
                emitter.send(SseEmitter.event().name("ping").data("keepalive"));
            } catch (Exception e) {
                log.debug("[YamlStream] client disconnected", e);
            }
        }, 10, 10, TimeUnit.SECONDS);
        emitter.onCompletion(() -> {
            heartbeat.cancel(true);
            heartbeatExecutor.shutdownNow();
        });
        emitter.onTimeout(() -> {
            heartbeat.cancel(true);
            heartbeatExecutor.shutdownNow();
        });
        new Thread(() -> {
            try {
                log.info("[YamlStream] start, nlpLength={}", nlp.trim().length());
                String yaml = yamlGeneratorService.generateYamlStream(nlp.trim(),
                        reasoning -> {
                            try {
                                emitter.send(SseEmitter.event().name("reasoning").data(reasoning));
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        },
                        chunk -> {
                            try {
                                emitter.send(SseEmitter.event().name("chunk").data(chunk));
                            } catch (Exception e) {
                                throw new RuntimeException(e);
                            }
                        });
                emitter.send(SseEmitter.event().name("complete").data(yaml));
                emitter.complete();
                log.info("[YamlStream] completed, yamlLength={}", yaml.length());
            } catch (Exception e) {
                log.error("[YamlStream] failed", e);
                try {
                    emitter.send(SseEmitter.event().name("error").data(e.getMessage()));
                } catch (Exception ignored) {
                }
                emitter.completeWithError(e);
            } finally {
                heartbeat.cancel(true);
                heartbeatExecutor.shutdownNow();
            }
        }, "yaml-generation-stream").start();
        return ResponseEntity.ok().headers(headers).contentType(MediaType.TEXT_EVENT_STREAM).body(emitter);
    }

    @Operation(summary = "Batch delete test cases")
    @PostMapping("/batch-delete")
    public ResponseEntity<?> batchDelete(@Parameter(description = "Case ID list") @Valid @RequestBody IdsRequest body) {
        int deleted = testCaseService.batchDelete(body.getIds());
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }
}
