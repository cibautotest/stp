package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Execute Service async execution request")
public class ExecuteRequest {

    @NotBlank(message = "id is required")
    @Size(max = 64, message = "id length must be at most 64")
    @Schema(description = "Case ID", requiredMode = Schema.RequiredMode.REQUIRED, example = "1234567890", maxLength = 64)
    private String id;

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Case name", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @Size(max = 200000, message = "yamlScript length must be at most 200000")
    @Schema(description = "YAML script content", maxLength = 200000)
    private String yamlScript;

    @Size(max = 20000, message = "nlp length must be at most 20000")
    @Schema(description = "Natural-language test instruction", maxLength = 20000)
    private String nlp;

    @Min(value = 1000, message = "timeout must be at least 1000 ms")
    @Max(value = 1800000, message = "timeout must be at most 1800000 ms")
    @Schema(description = "Timeout in milliseconds", example = "60000", minimum = "1000", maximum = "1800000")
    private Integer timeout;

    @Schema(description = "Whether browser runs in headless mode", example = "true")
    private Boolean headless;

    @Size(max = 500000, message = "cacheContent length must be at most 500000")
    @Schema(description = "Midscene UI cache content", maxLength = 500000)
    private String cacheContent;

    @Pattern(regexp = "NLP|YAML|nlp|yaml", message = "executionMode must be NLP or YAML")
    @Schema(description = "Execution mode", allowableValues = {"NLP", "YAML"})
    private String executionMode;

    @Schema(description = "Whether to inject SkyWalking SW8 and traffic tagging headers")
    private Boolean trafficTaggingEnabled;

    @Valid
    @Schema(description = "Kafka API exchange observation config")
    private KafkaConfig kafkaConfig;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Kafka config")
    public static class KafkaConfig {
        @Schema(description = "Whether Kafka publishing is enabled")
        private Boolean enabled;

        @Size(max = 1000, message = "brokers length must be at most 1000")
        @Schema(description = "Kafka bootstrap servers", maxLength = 1000)
        private String brokers;

        @Size(max = 200, message = "topic length must be at most 200")
        @Schema(description = "Kafka topic", maxLength = 200)
        private String topic;

        @Size(max = 100, message = "clientId length must be at most 100")
        @Schema(description = "Kafka client ID", maxLength = 100)
        private String clientId;

        @Size(max = 100, message = "username length must be at most 100")
        @Schema(description = "Kafka username", maxLength = 100)
        private String username;

        @Size(max = 512, message = "password length must be at most 512")
        @Schema(description = "Kafka password", maxLength = 512)
        private String password;
    }
}
