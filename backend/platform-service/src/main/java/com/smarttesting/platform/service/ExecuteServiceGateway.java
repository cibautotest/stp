package com.smarttesting.platform.service;

import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.ExecuteResponse;
import com.smarttesting.platform.model.ExecuteStatusResponse;
import com.smarttesting.platform.model.MergeReportRequest;
import com.smarttesting.platform.model.MergeReportResponse;
import org.springframework.http.ResponseEntity;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/** Calls the execution engine selected for the current execution. */
@Service
public class ExecuteServiceGateway {
    private final RestTemplate restTemplate = new RestTemplate();

    public ExecuteResponse asyncExecute(String baseUrl, ExecuteRequest request) {
        return restTemplate.postForObject(url(baseUrl, "/execute/async"), request, ExecuteResponse.class);
    }

    public ExecuteStatusResponse getStatus(String baseUrl, String executionId) {
        return restTemplate.getForObject(url(baseUrl, "/execute/" + executionId + "/status"), ExecuteStatusResponse.class);
    }

    public Map cancel(String baseUrl, String executionId) {
        return restTemplate.postForObject(url(baseUrl, "/execute/" + executionId + "/cancel"), null, Map.class);
    }

    public MergeReportResponse mergeReports(String baseUrl, MergeReportRequest request) {
        return restTemplate.postForObject(url(baseUrl, "/execute/merge-reports"), request, MergeReportResponse.class);
    }

    private String url(String baseUrl, String path) {
        if (baseUrl == null || baseUrl.isBlank()) throw new IllegalArgumentException("未配置执行机");
        return baseUrl.trim().replaceAll("/+$", "") + path;
    }
}
