package com.smarttesting.platform.model;

import com.smarttesting.platform.entity.ApiExchange;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class RootCauseAnalysisResponse {
    private Long reportId;
    private Boolean hasBackendError;
    private Boolean completed;
    private String status;
    private String modelName;
    private String reasoning;
    private String analysis;
    private String errorMessage;
    private LocalDateTime updatedAt;
    private List<ApiExchange> errorExchanges = new ArrayList<>();
}
