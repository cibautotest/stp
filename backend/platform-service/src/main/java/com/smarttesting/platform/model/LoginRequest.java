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

    @Size(max = 64, message = "captchaKey length must be at most 64")
    @Schema(description = "Captcha key (required only when the client enforces captcha)", maxLength = 64)
    private String captchaKey;

    @Size(max = 8, message = "captchaCode length must be at most 8")
    @Schema(description = "Captcha code typed by the user", maxLength = 8)
    private String captchaCode;
}
