package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.AiConfig;
import com.smarttesting.platform.service.AiConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.annotation.Resource;
import javax.validation.Valid;
import java.util.Map;

@Tag(name = "AI Config", description = "AI model configuration APIs")
@RestController
@RequestMapping("/api/platform")
public class AiConfigController {

    @Resource
    private AiConfigService aiConfigService;

    @Operation(summary = "Get AI config")
    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null) {
            return ResponseEntity.ok(Map.of());
        }
        AiConfig masked = new AiConfig();
        masked.setId(config.getId());
        masked.setBaseUrl(config.getBaseUrl());
        masked.setModelName(config.getModelName());
        masked.setModelFamily(config.getModelFamily());
        masked.setBrowserHeadless(config.getBrowserHeadless());
        String apiKey = config.getApiKey();
        masked.setApiKey(apiKey != null && apiKey.length() > 4 ? "****" + apiKey.substring(apiKey.length() - 4) : apiKey);
        return ResponseEntity.ok(masked);
    }

    @Operation(summary = "Save AI config")
    @PostMapping("/config")
    public ResponseEntity<?> saveConfig(@Parameter(description = "AI config payload") @Valid @RequestBody AiConfig config) {
        return updateConfig(config);
    }

    @Operation(summary = "Update AI config")
    @PutMapping("/config")
    public ResponseEntity<?> updateConfig(@Parameter(description = "AI config payload") @Valid @RequestBody AiConfig config) {
        AiConfig current = aiConfigService.getCurrentConfig();
        if (current != null) {
            config.setId(current.getId());
            config.setApiKey(config.getApiKey() != null ? config.getApiKey() : current.getApiKey());
            aiConfigService.updateById(config);
        } else {
            aiConfigService.save(config);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }
}
