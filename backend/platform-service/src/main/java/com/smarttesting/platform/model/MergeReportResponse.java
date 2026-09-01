package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "合并报告响应")
public class MergeReportResponse {

    @Schema(description = "是否成功")
    private Boolean success;

    @Schema(description = "合并报告文件路径")
    private String mergedReportPath;

    @Schema(description = "合并报告访问URL")
    private String mergedReportUrl;

    @Schema(description = "错误信息")
    private String error;
}
