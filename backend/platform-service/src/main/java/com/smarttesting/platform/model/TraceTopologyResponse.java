package com.smarttesting.platform.model;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Data
public class TraceTopologyResponse {
    private String traceId;
    private String errorMessage;
    private List<TopologyNode> nodes = new ArrayList<>();
    private List<TopologyEdge> edges = new ArrayList<>();
    private List<SpanSummary> spans = new ArrayList<>();

    @Data
    public static class TopologyNode {
        private String id;
        private String name;
        private String type;
        private String service;
        private String endpoint;
        private String peer;
        private Long durationMs;
        private Boolean error;
        private String errorMessage;
    }

    @Data
    public static class TopologyEdge {
        private String source;
        private String target;
        private String type;
        private String operation;
        private Long durationMs;
        private Boolean error;
        private String errorMessage;
    }

    @Data
    public static class SpanSummary {
        private String spanKey;
        private String parentSpanKey;
        private String service;
        private String endpoint;
        private String type;
        private String layer;
        private String component;
        private String peer;
        private String httpUrl;
        private String sql;
        private Map<String, String> tags;
        private Long startTime;
        private Long endTime;
        private Long durationMs;
        private Boolean error;
        private String errorMessage;
    }
}
