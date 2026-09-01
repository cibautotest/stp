package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@Schema(description = "NLP generation request")
public class NlpRequest {

    @NotBlank(message = "nlp is required")
    @Size(max = 20000, message = "nlp length must be at most 20000")
    @Schema(description = "Natural-language test instruction", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 20000)
    private String nlp;
}
