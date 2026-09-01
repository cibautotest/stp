package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 执行记录实体
 * 存储 executionId 与 caseId 的映射关系，用于状态同步
 */
@Data
@Schema(description = "执行记录")
@TableName("execution_record")
public class ExecutionRecord {

    @TableId(type = IdType.AUTO)
    @Schema(description = "记录ID")
    private Long id;

    @Schema(description = "关联用例ID")
    private String caseId;

    @Schema(description = "批次ID（批量执行时关联）")
    private String batchId;

    @Schema(description = "Execute Service 返回的 executionId")
    private String executionId;

    @Schema(description = "本次执行实际使用的执行机服务地址")
    private String executeServiceUrl;

    @Schema(description = "执行状态: PENDING/RUNNING/SUCCESS/FAILED")
    private String status;

    @Schema(description = "执行耗时（毫秒）")
    private Long duration;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
