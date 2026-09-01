package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Debug execute request")
public class DebugExecuteRequest {

    @NotBlank(message = "projectId is required")
    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String projectId;

    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Case name", maxLength = 100)
    private String name;

    @Size(max = 200000, message = "yamlScript length must be at most 200000")
    @Schema(description = "YAML script. Required when executionMode is YAML.", maxLength = 200000)
    private String yamlScript;

    @Size(max = 20000, message = "nlp length must be at most 20000")
    @Schema(description = "Natural-language instruction. Required unless executionMode is YAML.", maxLength = 20000)
    private String nlp;

    @Schema(description = "Whether browser runs in headless mode")
    private Boolean headless;

    @Pattern(regexp = "NLP|YAML|nlp|yaml", message = "executionMode must be NLP or YAML")
    @Schema(description = "Execution mode", allowableValues = {"NLP", "YAML"})
    private String executionMode;
}
