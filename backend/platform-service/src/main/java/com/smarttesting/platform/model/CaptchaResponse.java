package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 登录图形验证码响应：key 供登录请求回传，image 为 PNG base64 data URI
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Login image captcha")
public class CaptchaResponse {

    @Schema(description = "Captcha key (pass back with login request)", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String key;

    @Schema(description = "Captcha image as data URI (data:image/png;base64,...)", requiredMode = Schema.RequiredMode.REQUIRED)
    private String image;
}
