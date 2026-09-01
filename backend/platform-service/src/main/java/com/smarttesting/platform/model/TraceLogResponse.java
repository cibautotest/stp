package com.smarttesting.platform.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class TraceLogResponse {
    private String traceId;
    private String errorMessage;
    private List<LogEntry> logs = new ArrayList<>();

    @Data
    public static class LogEntry {
        private String service;
        private String level;
        private String content;
        private String traceId;
        private Long timestamp;
    }
}
