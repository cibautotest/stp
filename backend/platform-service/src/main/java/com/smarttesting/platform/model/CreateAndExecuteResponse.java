package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 创建测试用例并异步执行的响应体
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "创建用例并异步执行响应")
public class CreateAndExecuteResponse {

    @Schema(description = "新创建的用例ID")
    private String caseId;

    @Schema(description = "执行引擎返回的 executionId，用于后续轮询状态；为 null 表示提交执行失败")
    private String executionId;

    @Schema(description = "用例是否创建成功", example = "true")
    private boolean success = true;

    @Schema(description = "错误信息，仅在 success=false 时有值")
    private String error;
}
