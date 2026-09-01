package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * Execute Service 状态查询响应
 */
@Data
@Schema(description = "执行状态响应")
public class ExecuteStatusResponse {

    @Schema(description = "执行ID")
    private String executionId;

    @Schema(description = "执行状态: pending/queued/running/completed/failed/cancelled")
    private String status;

    @Schema(description = "进度百分比 (0-100)")
    private Integer progress;

    @Schema(description = "开始时间 (ISO 8601)")
    private String startedAt;

    @Schema(description = "完成时间 (ISO 8601)")
    private String completedAt;

    @Schema(description = "耗时(ms)")
    private Long duration;

    @Schema(description = "报告访问 URL")
    private String reportUrl;

    @Schema(description = "错误信息")
    private String error;

    @Schema(description = "队列位置（-1 表示不在队列中）")
    private Integer queuePosition;
}
