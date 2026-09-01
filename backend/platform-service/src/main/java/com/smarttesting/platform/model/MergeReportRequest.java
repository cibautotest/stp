package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
import java.util.List;

@Data
@Schema(description = "Merge report request")
public class MergeReportRequest {

    @NotEmpty(message = "executionIds is required")
    @Size(max = 200, message = "executionIds size must be at most 200")
    @Schema(description = "Execution ID list to merge", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<@Size(max = 128, message = "executionId length must be at most 128") String> executionIds;

    @Size(max = 100, message = "batchName length must be at most 100")
    @Schema(description = "Merged report file name", maxLength = 100)
    private String batchName;
}
