package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
@TableName("login_methods")
@Schema(description = "Project login method (reusable across cases)")
public class LoginMethod {

    @TableId(type = IdType.ASSIGN_ID)
    @Size(max = 64, message = "id length must be at most 64")
    @Schema(description = "Login method ID", maxLength = 64)
    private String id;

    @NotBlank(message = "projectId is required")
    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String projectId;

    @NotBlank(message = "name is required")
    @Size(max = 128, message = "name length must be at most 128")
    @Schema(description = "Login method name", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 128)
    private String name;

    @NotBlank(message = "type is required")
    @Size(max = 16, message = "type length must be at most 16")
    @Schema(description = "Login type: none / cas / local", requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"none", "cas", "local"}, maxLength = 16)
    private String type;

    @Size(max = 512, message = "loginUrl length must be at most 512")
    @Schema(description = "Login page URL", maxLength = 512)
    private String loginUrl;

    @Size(max = 64, message = "roleName length must be at most 64")
    @Schema(description = "Account role name (e.g. admin / general user)", maxLength = 64)
    private String roleName;

    @Size(max = 128, message = "username length must be at most 128")
    @Schema(description = "Account username", maxLength = 128)
    private String username;

    @Size(max = 256, message = "password length must be at most 256")
    @Schema(description = "Account password (encrypted)", maxLength = 256)
    private String password;

    @Schema(description = "Extra login steps in natural language (captcha / popup handling etc.)")
    private String stepsNlp;

    @Schema(description = "Generated login YAML script")
    private String yamlScript;

    @Size(max = 16, message = "cacheStatus length must be at most 16")
    @Schema(description = "Cache status: uncached / cached", allowableValues = {"uncached", "cached"}, maxLength = 16)
    private String cacheStatus;

    @Schema(description = "Created time")
    private LocalDateTime createdAt;

    @Schema(description = "Updated time")
    private LocalDateTime updatedAt;

    @TableLogic
    @Schema(description = "Logic deleted flag", hidden = true)
    private Integer deleted;
}
