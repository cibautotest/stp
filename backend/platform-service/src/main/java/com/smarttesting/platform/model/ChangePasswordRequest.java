package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;

@Data
@Schema(description = "Change password request")
public class ChangePasswordRequest {

    @NotBlank(message = "oldPassword is required")
    @Size(min = 6, max = 128, message = "oldPassword length must be 6-128")
    @Schema(description = "Old password", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 6, maxLength = 128)
    private String oldPassword;

    @NotBlank(message = "newPassword is required")
    @Size(min = 6, max = 128, message = "newPassword length must be 6-128")
    @Schema(description = "New password", requiredMode = Schema.RequiredMode.REQUIRED, minLength = 6, maxLength = 128)
    private String newPassword;
}
