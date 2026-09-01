package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.RootCauseAnalysis;
import com.smarttesting.platform.model.RootCauseAnalysisResponse;
import com.smarttesting.platform.service.RootCauseAnalysisService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import javax.validation.constraints.Positive;

@Tag(name = "Root Cause Analysis", description = "AI root-cause analysis for failed reports")
@RestController
@RequestMapping("/api/platform/reports/{reportId}/root-cause-analysis")
@Validated
public class RootCauseAnalysisController {

    private static final Logger log = LoggerFactory.getLogger(RootCauseAnalysisController.class);

    private final RootCauseAnalysisService rootCauseAnalysisService;

    public RootCauseAnalysisController(RootCauseAnalysisService rootCauseAnalysisService) {
        this.rootCauseAnalysisService = rootCauseAnalysisService;
    }

    @Operation(summary = "Get cached root-cause analysis and failed backend APIs")
    @GetMapping
    public RootCauseAnalysisResponse get(@Positive @PathVariable Long reportId) {
        return rootCauseAnalysisService.getAnalysis(reportId);
    }

    @Operation(summary = "Stream AI root-cause analysis for a failed report")
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream(@Positive @PathVariable Long reportId) {
        SseEmitter emitter = new SseEmitter(0L);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_EVENT_STREAM);
        headers.setCacheControl(CacheControl.noCache().getHeaderValue());
        headers.add("X-Accel-Buffering", "no");

        new Thread(() -> {
            try {
                emitter.send(SseEmitter.event().name("started").data("root cause analysis started"));
                RootCauseAnalysis result = rootCauseAnalysisService.analyzeStream(
                        reportId,
                        chunk -> send(emitter, "reasoning", chunk),
                        chunk -> send(emitter, "chunk", chunk));
                emitter.send(SseEmitter.event().name("complete").data(result.getAnalysis() == null ? "" : result.getAnalysis()));
                emitter.complete();
            } catch (Exception e) {
                log.error("[RootCauseAnalysis] stream failed: reportId={}", reportId, e);
                send(emitter, "error", e.getMessage());
                emitter.completeWithError(e);
            }
        }, "root-cause-analysis-stream").start();

        return ResponseEntity.ok().headers(headers).body(emitter);
    }

    private void send(SseEmitter emitter, String event, String data) {
        try {
            emitter.send(SseEmitter.event().name(event).data(data == null ? "" : data));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
