package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.LocalDateTime;

@Data
@Schema(description = "Project")
@TableName("projects")
public class Project {

    @TableId(type = IdType.ASSIGN_ID)
    @Size(max = 64, message = "id length must be at most 64")
    @Schema(description = "Project ID", example = "1234567890", maxLength = 64)
    private String id;

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Project name", example = "E-commerce testing", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @Size(max = 1000, message = "description length must be at most 1000")
    @Schema(description = "Project description", maxLength = 1000)
    private String description;

    @Size(max = 255, message = "executeServiceUrl length must be at most 255")
    @Schema(description = "Default execute service URL", example = "http://execute.example.com:3001", maxLength = 255)
    private String executeServiceUrl;

    @Size(max = 255, message = "skywalkingGraphqlUrl length must be at most 255")
    @Schema(description = "SkyWalking GraphQL URL", example = "http://skywalking.example.com:12800/graphql", maxLength = 255)
    private String skywalkingGraphqlUrl;

    @Schema(description = "Whether to inject SkyWalking SW8 and traffic tagging headers")
    private Boolean trafficTaggingEnabled;

    @Schema(description = "Whether to publish captured browser request/response exchanges to Kafka")
    private Boolean apiExchangeKafkaEnabled;

    @Schema(description = "Creator user ID", example = "1")
    private Long createdBy;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "Created time")
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "Updated time")
    private LocalDateTime updatedAt;

    @TableLogic
    @Schema(description = "Logic deleted flag", hidden = true)
    private Integer deleted;
}
