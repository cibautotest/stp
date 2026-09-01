package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

@Data
@Schema(description = "批量执行进度响应")
public class BatchProgressResponse {

    @Schema(description = "批次ID")
    private String batchId;

    @Schema(description = "项目ID")
    private String projectId;

    @Schema(description = "项目名称")
    private String projectName;

    @Schema(description = "用例总数")
    private Integer total;

    @Schema(description = "已完成数")
    private Integer completed;

    @Schema(description = "成功数")
    private Integer success;

    @Schema(description = "失败数")
    private Integer failed;

    @Schema(description = "运行中数")
    private Integer running;

    @Schema(description = "批次状态: RUNNING/COMPLETED")
    private String status;

    @Schema(description = "各用例执行状态列表")
    private List<BatchCaseStatus> cases;

    @Schema(description = "合并报告URL（批次完成后）")
    private String mergedReportUrl;

    @Data
    @Schema(description = "批次中单个用例的状态")
    public static class BatchCaseStatus {

        @Schema(description = "用例ID")
        private String caseId;

        @Schema(description = "用例名称")
        private String caseName;

        @Schema(description = "executionId")
        private String executionId;

        @Schema(description = "执行状态: RUNNING/SUCCESS/FAILED")
        private String status;
    }
}
