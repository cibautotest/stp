package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Create case and execute request")
public class CreateAndExecuteRequest {

    @NotBlank(message = "projectId is required")
    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String projectId;

    @NotBlank(message = "directoryId is required")
    @Size(max = 64, message = "directoryId length must be at most 64")
    @Schema(description = "Case directory ID under the project", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String directoryId;

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Case name", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @Size(max = 1000, message = "description length must be at most 1000")
    @Schema(description = "Case description", maxLength = 1000)
    private String description;

    @Size(max = 20000, message = "nlp length must be at most 20000")
    @Schema(description = "Natural-language test instruction. Required unless executionMode is YAML.", maxLength = 20000)
    private String nlp;

    @Size(max = 200000, message = "customYaml length must be at most 200000")
    @Schema(description = "Custom YAML script", maxLength = 200000)
    private String customYaml;

    @Schema(description = "Whether browser runs in headless mode")
    private Boolean headless;

    @Pattern(regexp = "NLP|YAML|nlp|yaml", message = "executionMode must be NLP or YAML")
    @Schema(description = "Execution mode", allowableValues = {"NLP", "YAML"})
    private String executionMode;
}
