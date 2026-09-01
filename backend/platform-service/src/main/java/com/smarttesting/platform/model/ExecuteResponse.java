package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Execute Service 异步执行响应
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Execute Service 异步执行响应")
public class ExecuteResponse {

    @Schema(description = "执行ID", example = "550e8400-e29b-41d4-a716-446655440000")
    private String executionId;

    @Schema(description = "执行状态", example = "queued")
    private String status;
}
