package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "批量执行响应")
public class BatchExecuteResponse {

    @Schema(description = "批次ID")
    private String batchId;

    @Schema(description = "用例总数")
    private Integer total;

    @Schema(description = "提示信息")
    private String message;
}
