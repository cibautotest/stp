package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户实体
 */
@Data
@Schema(description = "系统用户")
@TableName("users")
public class User {

    @TableId(type = IdType.AUTO)
    @Schema(description = "用户ID")
    private Long id;

    @Schema(description = "用户名（唯一）", example = "sysadmin")
    private String username;

    @Schema(description = "密码（BCrypt 加密）", hidden = true)
    private String password;

    @Schema(description = "显示名称", example = "系统管理员")
    private String displayName;

    @Schema(description = "角色: sysadmin / general", example = "general")
    private String role;

    @Schema(description = "状态: 0-禁用, 1-启用", example = "1")
    private Integer status;

    @Schema(description = "用户专属执行机服务地址，优先于项目配置", example = "http://execute.example.com:3001")
    private String executeServiceUrl;

    @Schema(description = "最后登录时间")
    private LocalDateTime lastLoginAt;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @TableLogic
    @Schema(description = "逻辑删除标记", hidden = true)
    private Integer deleted;
}
