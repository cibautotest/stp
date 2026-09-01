package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.Size;
import java.util.List;

@Data
@Schema(description = "ID list request")
public class IdsRequest {

    @NotEmpty(message = "ids is required")
    @Size(max = 200, message = "ids size must be at most 200")
    @Schema(description = "ID list", requiredMode = Schema.RequiredMode.REQUIRED)
    private List<@Size(max = 64, message = "id length must be at most 64") String> ids;
}
