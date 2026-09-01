package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Create user request")
public class UserCreateRequest {

    @NotBlank(message = "username is required")
    @Size(min = 3, max = 50, message = "username length must be 3-50")
    @Pattern(regexp = "^[A-Za-z0-9_.-]+$", message = "username can only contain letters, numbers, underscore, dot and hyphen")
    @Schema(description = "Username", example = "tester01", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 3, maxLength = 50)
    private String username;

    @NotBlank(message = "password is required")
    @Size(min = 6, max = 128, message = "password length must be 6-128")
    @Schema(description = "Initial password", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 6, maxLength = 128)
    private String password;

    @Size(max = 50, message = "displayName length must be at most 50")
    @Schema(description = "Display name", example = "Tester", maxLength = 50)
    private String displayName;

    @Pattern(regexp = "sysadmin|general", message = "role must be sysadmin or general")
    @Schema(description = "Role", allowableValues = {"sysadmin", "general"}, example = "general")
    private String role;

    @Min(value = 0, message = "status must be 0 or 1")
    @Max(value = 1, message = "status must be 0 or 1")
    @Schema(description = "User status: 0 disabled, 1 enabled", allowableValues = {"0", "1"}, example = "1", minimum = "0", maximum = "1")
    private Integer status = 1;

    @Size(max = 255, message = "executeServiceUrl length must be at most 255")
    @Schema(description = "Personal execute service URL", example = "http://execute.example.com:3001", maxLength = 255)
    private String executeServiceUrl;
}
