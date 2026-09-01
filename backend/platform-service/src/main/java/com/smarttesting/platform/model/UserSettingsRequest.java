package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Size;

@Data
@Schema(description = "Current user settings update request")
public class UserSettingsRequest {

    @Size(max = 50, message = "displayName length must be at most 50")
    @Schema(description = "Display name", example = "Tester", maxLength = 50)
    private String displayName;

    @Size(max = 255, message = "executeServiceUrl length must be at most 255")
    @Schema(description = "Personal execute service URL", example = "http://execute.example.com:3001", maxLength = 255)
    private String executeServiceUrl;
}
