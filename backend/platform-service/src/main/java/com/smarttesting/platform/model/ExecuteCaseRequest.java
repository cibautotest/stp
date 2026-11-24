package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Execute existing case request")
public class ExecuteCaseRequest {

    @Size(max = 200000, message = "customYaml length must be at most 200000")
    @Schema(description = "Custom YAML content", maxLength = 200000)
    private String customYaml;

    @Schema(description = "Whether to run browser in headless mode", example = "true")
    private Boolean headless;

    @Pattern(regexp = "NLP|YAML|CODE|nlp|yaml|code", message = "executionMode must be NLP, YAML or CODE")
    @Schema(description = "Execution mode", allowableValues = {"NLP", "YAML", "CODE"}, example = "YAML")
    private String executionMode;
}
