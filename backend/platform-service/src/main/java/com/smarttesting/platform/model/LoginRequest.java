package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Login request")
public class LoginRequest {

    @NotBlank(message = "username is required")
    @Size(min = 3, max = 50, message = "username length must be 3-50")
    @Schema(description = "Username", example = "sysadmin", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 3, maxLength = 50)
    private String username;

    @NotBlank(message = "password is required")
    @Size(min = 6, max = 128, message = "password length must be 6-128")
    @Schema(description = "Password", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 6, maxLength = 128)
    private String password;
}
