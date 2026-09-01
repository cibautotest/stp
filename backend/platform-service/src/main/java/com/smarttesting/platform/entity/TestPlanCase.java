package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 计划-用例关联实体
 */
@Data
@Schema(description = "计划-用例关联")
@TableName("test_plan_cases")
public class TestPlanCase {

    @TableId(type = IdType.AUTO)
    @Schema(description = "记录ID")
    private Long id;

    @Schema(description = "计划ID", required = true)
    private String planId;

    @Schema(description = "用例ID", required = true)
    private String caseId;

    @Schema(description = "排序序号", example = "0")
    private Integer sortOrder;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
