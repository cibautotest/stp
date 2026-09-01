package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Update user request")
public class UserUpdateRequest {

    @Size(max = 50, message = "displayName length must be at most 50")
    @Schema(description = "Display name", maxLength = 50)
    private String displayName;

    @Pattern(regexp = "sysadmin|general", message = "role must be sysadmin or general")
    @Schema(description = "Role", allowableValues = {"sysadmin", "general"}, example = "general")
    private String role;

    @Min(value = 0, message = "status must be 0 or 1")
    @Max(value = 1, message = "status must be 0 or 1")
    @Schema(description = "User status: 0 disabled, 1 enabled", allowableValues = {"0", "1"}, minimum = "0", maximum = "1")
    private Integer status;

    @Size(max = 255, message = "executeServiceUrl length must be at most 255")
    @Schema(description = "Personal execute service URL", maxLength = 255)
    private String executeServiceUrl;
}
