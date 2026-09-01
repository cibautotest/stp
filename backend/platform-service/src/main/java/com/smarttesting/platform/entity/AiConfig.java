package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
@Schema(description = "AI model configuration")
@TableName("ai_config")
public class AiConfig {

    @TableId(type = IdType.AUTO)
    @Schema(description = "Configuration ID")
    private Long id;

    @Size(max = 255, message = "baseUrl length must be at most 255")
    @Schema(description = "API base URL", example = "https://api.openai.com/v1", maxLength = 255)
    private String baseUrl;

    @Size(max = 512, message = "apiKey length must be at most 512")
    @Schema(description = "API key", maxLength = 512)
    private String apiKey;

    @NotBlank(message = "modelName is required")
    @Size(max = 100, message = "modelName length must be at most 100")
    @Schema(description = "Model name", example = "gpt-4o", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String modelName;

    @Size(max = 50, message = "modelFamily length must be at most 50")
    @Schema(description = "Model family", example = "openai", maxLength = 50)
    private String modelFamily;

    @Schema(description = "Whether browser runs in headless mode")
    private Boolean browserHeadless;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "Created time")
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "Updated time")
    private LocalDateTime updatedAt;
}
