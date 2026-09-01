package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Password reset request")
public class PasswordResetRequest {

    @NotBlank(message = "password is required")
    @Size(min = 6, max = 128, message = "password length must be 6-128")
    @Schema(description = "New password", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 6, maxLength = 128)
    private String password;
}
