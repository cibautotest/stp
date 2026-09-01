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
@TableName("case_directories")
@Schema(description = "Case directory")
public class CaseDirectory {

    @TableId(type = IdType.ASSIGN_ID)
    @Size(max = 64, message = "id length must be at most 64")
    @Schema(description = "Directory ID", maxLength = 64)
    private String id;

    @NotBlank(message = "projectId is required")
    @Size(max = 64, message = "projectId length must be at most 64")
    @Schema(description = "Project ID", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 64)
    private String projectId;

    @Size(max = 64, message = "parentId length must be at most 64")
    @Schema(description = "Parent directory ID", maxLength = 64)
    private String parentId;

    @NotBlank(message = "name is required")
    @Size(max = 100, message = "name length must be at most 100")
    @Schema(description = "Directory name", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 100)
    private String name;

    @Schema(description = "Created time")
    private LocalDateTime createdAt;

    @Schema(description = "Updated time")
    private LocalDateTime updatedAt;

    @TableLogic
    @Schema(description = "Logic deleted flag", hidden = true)
    private Integer deleted;
}
