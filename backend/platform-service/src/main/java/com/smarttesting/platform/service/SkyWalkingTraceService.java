package com.smarttesting.platform.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttesting.platform.entity.ApiExchange;
import com.smarttesting.platform.model.TraceLogResponse;
import com.smarttesting.platform.model.TraceTopologyResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SkyWalkingTraceService {
    private static final String QUERY_TRACE =
            "query queryTrace($traceId: ID!) {\n" +
            "  trace: queryTrace(traceId: $traceId) {\n" +
            "    spans {\n" +
            "      traceId\n" +
            "      segmentId\n" +
            "      spanId\n" +
            "      parentSpanId\n" +
            "      refs {\n" +
            "        traceId\n" +
            "        parentSegmentId\n" +
            "        parentSpanId\n" +
            "        type\n" +
            "      }\n" +
            "      serviceCode\n" +
            "      serviceInstanceName\n" +
            "      startTime\n" +
            "      endTime\n" +
            "      endpointName\n" +
            "      type\n" +
            "      peer\n" +
            "      component\n" +
            "      isError\n" +
            "      layer\n" +
            "      tags { key value }\n" +
            "      logs { time data { key value } }\n" +
            "      attachedEvents {\n" +
            "        startTime { seconds nanos }\n" +
            "        event\n" +
            "        endTime { seconds nanos }\n" +
            "        tags { key value }\n" +
            "        summary { key value }\n" +
            "      }\n" +
            "    }\n" +
            "  }\n" +
            "}";
    private static final String QUERY_LOGS =
            "query queryLogs($condition: LogQueryCondition) {\n" +
            "  queryLogs(condition: $condition) {\n" +
            "    errorReason\n" +
            "    logs {\n" +
            "      serviceName\n" +
            "      traceId\n" +
            "      timestamp\n" +
            "      content\n" +
            "      tags { key value }\n" +
            "    }\n" +
            "  }\n" +
            "}";
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper;

    @Value("${observability.skywalking.graphql-url:http://localhost:12800/graphql}")
    private String graphqlUrl;

    public SkyWalkingTraceService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public TraceTopologyResponse getTopology(ApiExchange exchange) {
        return getTopology(exchange, null);
    }

    public TraceTopologyResponse getTopology(ApiExchange exchange, String projectGraphqlUrl) {
        TraceTopologyResponse response = new TraceTopologyResponse();
        response.setTraceId(exchange == null ? null : exchange.getTraceId());
        if (exchange == null || !StringUtils.hasText(exchange.getTraceId())) {
            response.setErrorMessage("missing traceId");
            return response;
        }

        try {
            JsonNode root = queryTrace(exchange.getTraceId(), projectGraphqlUrl);
            JsonNode spansNode = root.path("data").path("trace").path("spans");
            if (!spansNode.isArray() || spansNode.size() == 0) {
                response.setErrorMessage("trace data not found in SkyWalking");
                return response;
            }
            List<SpanInfo> spans = new ArrayList<>();
            for (JsonNode spanNode : spansNode) {
                spans.add(toSpanInfo(spanNode));
            }
            spans.sort(Comparator.comparingLong(s -> s.startTime == null ? 0L : s.startTime));
            buildTopology(response, exchange, spans);
        } catch (Exception ex) {
            response.setErrorMessage(ex.getMessage());
        }
        return response;
    }

    public TraceLogResponse getLogs(ApiExchange exchange, String projectGraphqlUrl) {
        TraceLogResponse response = new TraceLogResponse();
        response.setTraceId(exchange == null ? null : exchange.getTraceId());
        if (exchange == null || !StringUtils.hasText(exchange.getTraceId())) {
            response.setErrorMessage("missing traceId");
            return response;
        }

        try {
            JsonNode root = queryLogs(exchange.getTraceId(), projectGraphqlUrl);
            JsonNode logsRoot = root.path("data").path("queryLogs");
            String errorReason = text(logsRoot, "errorReason");
            if (StringUtils.hasText(errorReason)) {
                response.setErrorMessage(errorReason);
                return response;
            }

            JsonNode logsNode = logsRoot.path("logs");
            if (!logsNode.isArray() || logsNode.size() == 0) {
                response.setErrorMessage("log data not found in SkyWalking");
                return response;
            }

            for (JsonNode logNode : logsNode) {
                response.getLogs().add(toLogEntry(logNode, exchange.getTraceId()));
            }
            response.getLogs().sort(Comparator.comparingLong(log -> log.getTimestamp() == null ? 0L : log.getTimestamp()));
        } catch (Exception ex) {
            response.setErrorMessage(ex.getMessage());
        }
        return response;
    }

    private JsonNode queryTrace(String traceId, String projectGraphqlUrl) {
        Map<String, Object> body = new HashMap<>();
        body.put("query", QUERY_TRACE);
        body.put("variables", Collections.singletonMap("traceId", traceId));

        return querySkyWalking(body, projectGraphqlUrl);
    }

    private JsonNode queryLogs(String traceId, String projectGraphqlUrl) {
        Map<String, Object> relatedTrace = new HashMap<>();
        relatedTrace.put("traceId", traceId);

        Map<String, Object> paging = new HashMap<>();
        paging.put("pageNum", 1);
        paging.put("pageSize", 200);

        Map<String, Object> condition = new HashMap<>();
        condition.put("relatedTrace", relatedTrace);
        condition.put("paging", paging);
        condition.put("queryOrder", "ASC");

        Map<String, Object> body = new HashMap<>();
        body.put("query", QUERY_LOGS);
        body.put("variables", Collections.singletonMap("condition", condition));

        return querySkyWalking(body, projectGraphqlUrl);
    }

    private JsonNode querySkyWalking(Map<String, Object> body, String projectGraphqlUrl) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        String endpoint = StringUtils.hasText(projectGraphqlUrl) ? projectGraphqlUrl.trim() : graphqlUrl;
        String raw = restTemplate.postForObject(endpoint, new HttpEntity<>(body, headers), String.class);
        try {
            JsonNode root = objectMapper.readTree(raw);
            JsonNode errors = root.path("errors");
            if (errors.isArray() && errors.size() > 0) {
                throw new IllegalStateException(errors.get(0).path("message").asText("SkyWalking GraphQL error"));
            }
            return root;
        } catch (Exception ex) {
            throw new IllegalStateException("failed to parse SkyWalking response: " + ex.getMessage(), ex);
        }
    }

    private TraceLogResponse.LogEntry toLogEntry(JsonNode node, String fallbackTraceId) {
        Map<String, String> tags = tags(node.path("tags"));
        String content = text(node, "content");

        TraceLogResponse.LogEntry entry = new TraceLogResponse.LogEntry();
        entry.setService(text(node, "serviceName"));
        entry.setLevel(resolveLogLevel(tags, content));
        entry.setContent(content);
        entry.setTraceId(blankToDefault(text(node, "traceId"), fallbackTraceId));
        entry.setTimestamp(longValue(node, "timestamp"));
        return entry;
    }

    private String resolveLogLevel(Map<String, String> tags, String content) {
        String level = firstTag(tags, "level", "LEVEL", "log.level", "severity", "severityText");
        if (StringUtils.hasText(level)) {
            return level.toUpperCase();
        }
        if (StringUtils.hasText(content)) {
            String upper = content.toUpperCase();
            for (String candidate : new String[]{"TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"}) {
                if (upper.matches("(^|.*\\s)" + candidate + "(\\s|:|\\]|\\)|$).*")) {
                    return candidate;
                }
            }
        }
        return "-";
    }

    private void buildTopology(TraceTopologyResponse response, ApiExchange exchange, List<SpanInfo> spans) {
        Map<String, TraceTopologyResponse.TopologyNode> nodes = new LinkedHashMap<>();
        Map<String, TraceTopologyResponse.TopologyEdge> edges = new LinkedHashMap<>();
        Map<String, SpanInfo> spanByKey = new HashMap<>();
        for (SpanInfo span : spans) {
            spanByKey.put(span.key, span);
        }

        String apiNodeId = "api:" + exchange.getRequestId();
        TraceTopologyResponse.TopologyNode apiNode = new TraceTopologyResponse.TopologyNode();
        apiNode.setId(apiNodeId);
        apiNode.setName((blankToDefault(exchange.getMethod(), "HTTP")) + " " + shortUrl(exchange.getUrl()));
        apiNode.setType("api");
        apiNode.setEndpoint(exchange.getUrl());
        apiNode.setDurationMs(exchange.getDurationMs());
        apiNode.setError(exchange.getErrorMessage() != null || (exchange.getStatusCode() != null && exchange.getStatusCode() >= 400));
        apiNode.setErrorMessage(exchange.getErrorMessage());
        nodes.put(apiNodeId, apiNode);

        Set<String> connectedEntryServices = new HashSet<>();
        for (SpanInfo span : spans) {
            addServiceNode(nodes, span);
            if (!"unknown".equalsIgnoreCase(blankToDefault(span.layer, ""))) {
                response.getSpans().add(toSpanSummary(span));
            }

            if (isDependencySpan(span)) {
                TraceTopologyResponse.TopologyNode dependencyNode = dependencyNode(span);
                nodes.putIfAbsent(dependencyNode.getId(), dependencyNode);
                addEdge(edges, serviceNodeId(span.service), dependencyNode.getId(), dependencyType(span), span.endpoint, span.durationMs, span.error, span.errorMessage);
                continue;
            }

            SpanInfo parent = parentSpan(spanByKey, span);
            if (parent != null && StringUtils.hasText(parent.service) && !parent.service.equals(span.service)) {
                addEdge(edges, serviceNodeId(parent.service), serviceNodeId(span.service), "service", span.endpoint, span.durationMs, span.error, span.errorMessage);
                connectedEntryServices.add(span.service);
            }
        }

        for (SpanInfo span : spans) {
            if ("ENTRY".equalsIgnoreCase(span.type) && !connectedEntryServices.contains(span.service)) {
                addEdge(edges, apiNodeId, serviceNodeId(span.service), "entry", span.endpoint, span.durationMs, span.error, span.errorMessage);
                break;
            }
        }

        response.setNodes(new ArrayList<>(nodes.values()));
        response.setEdges(new ArrayList<>(edges.values()));
    }

    private SpanInfo parentSpan(Map<String, SpanInfo> spanByKey, SpanInfo span) {
        if (StringUtils.hasText(span.parentKey)) {
            return spanByKey.get(span.parentKey);
        }
        return null;
    }

    private void addServiceNode(Map<String, TraceTopologyResponse.TopologyNode> nodes, SpanInfo span) {
        String service = blankToDefault(span.service, "unknown-service");
        String id = serviceNodeId(service);
        TraceTopologyResponse.TopologyNode node = nodes.get(id);
        if (node == null) {
            node = new TraceTopologyResponse.TopologyNode();
            node.setId(id);
            node.setName(service);
            node.setType("service");
            node.setService(service);
            node.setDurationMs(0L);
            node.setError(false);
            nodes.put(id, node);
        }
        node.setDurationMs((node.getDurationMs() == null ? 0L : node.getDurationMs()) + (span.durationMs == null ? 0L : span.durationMs));
        node.setError(Boolean.TRUE.equals(node.getError()) || Boolean.TRUE.equals(span.error));
        node.setErrorMessage(mergeErrorMessage(node.getErrorMessage(), span.errorMessage));
    }

    private TraceTopologyResponse.TopologyNode dependencyNode(SpanInfo span) {
        TraceTopologyResponse.TopologyNode node = new TraceTopologyResponse.TopologyNode();
        node.setId("dep:" + dependencyType(span) + ":" + blankToDefault(span.peer, span.endpoint) + ":" + span.key);
        node.setName(blankToDefault(span.peer, blankToDefault(span.endpoint, dependencyType(span).toUpperCase())));
        node.setType(dependencyType(span));
        node.setService(span.service);
        node.setEndpoint(span.endpoint);
        node.setPeer(span.peer);
        node.setDurationMs(span.durationMs);
        node.setError(span.error);
        node.setErrorMessage(span.errorMessage);
        return node;
    }

    private void addEdge(Map<String, TraceTopologyResponse.TopologyEdge> edges, String source, String target, String type, String operation, Long durationMs, Boolean error, String errorMessage) {
        if (!StringUtils.hasText(source) || !StringUtils.hasText(target) || source.equals(target)) {
            return;
        }
        String key = source + "->" + target + ":" + blankToDefault(operation, type);
        TraceTopologyResponse.TopologyEdge edge = edges.get(key);
        if (edge == null) {
            edge = new TraceTopologyResponse.TopologyEdge();
            edge.setSource(source);
            edge.setTarget(target);
            edge.setType(type);
            edge.setOperation(operation);
            edge.setDurationMs(durationMs);
            edge.setError(error);
            edge.setErrorMessage(errorMessage);
            edges.put(key, edge);
        } else {
            edge.setDurationMs((edge.getDurationMs() == null ? 0L : edge.getDurationMs()) + (durationMs == null ? 0L : durationMs));
            edge.setError(Boolean.TRUE.equals(edge.getError()) || Boolean.TRUE.equals(error));
            edge.setErrorMessage(mergeErrorMessage(edge.getErrorMessage(), errorMessage));
        }
    }

    private boolean isDependencySpan(SpanInfo span) {
        String text = (blankToDefault(span.layer, "") + " " + blankToDefault(span.component, "") + " " + blankToDefault(span.peer, "") + " " + blankToDefault(span.endpoint, "")).toLowerCase();
        return text.contains("database") || text.contains("mysql") || text.contains("postgres") || text.contains("oracle")
                || text.contains("redis") || text.contains("cache")
                || text.contains("kafka") || text.contains("rabbitmq") || text.contains("rocketmq") || text.contains("activemq") || text.contains("mq");
    }

    private String dependencyType(SpanInfo span) {
        String text = (blankToDefault(span.layer, "") + " " + blankToDefault(span.component, "") + " " + blankToDefault(span.peer, "") + " " + blankToDefault(span.endpoint, "")).toLowerCase();
        if (text.contains("redis") || text.contains("cache")) return "redis";
        if (text.contains("kafka") || text.contains("rabbitmq") || text.contains("rocketmq") || text.contains("activemq") || text.contains("mq")) return "mq";
        if (text.contains("database") || text.contains("mysql") || text.contains("postgres") || text.contains("oracle")) return "database";
        return "dependency";
    }

    private SpanInfo toSpanInfo(JsonNode node) {
        SpanInfo span = new SpanInfo();
        span.segmentId = text(node, "segmentId");
        span.spanId = text(node, "spanId");
        span.key = span.segmentId + ":" + span.spanId;
        span.service = firstText(node, "serviceCode", "serviceName");
        span.endpoint = text(node, "endpointName");
        span.type = text(node, "type");
        span.layer = firstText(node, "spanLayer", "layer");
        span.component = text(node, "component");
        span.peer = text(node, "peer");
        span.tags = tags(node.path("tags"));
        span.httpUrl = firstTag(span.tags, "url", "http.url", "http_url", "http.uri", "http.path");
        span.sql = firstTag(span.tags, "db.statement", "db.sql", "sql", "database.statement", "db.statement.parameters");
        span.startTime = longValue(node, "startTime");
        span.endTime = longValue(node, "endTime");
        span.durationMs = span.startTime != null && span.endTime != null ? Math.max(0L, span.endTime - span.startTime) : null;
        span.error = node.path("isError").asBoolean(false);
        span.errorMessage = extractSpanErrorMessage(node, span.tags);

        String parentSpanId = text(node, "parentSpanId");
        if (StringUtils.hasText(parentSpanId) && !"-1".equals(parentSpanId)) {
            span.parentKey = span.segmentId + ":" + parentSpanId;
        }
        JsonNode refs = node.path("refs");
        if (!StringUtils.hasText(span.parentKey) && refs.isArray() && refs.size() > 0) {
            JsonNode ref = refs.get(0);
            String parentSegmentId = text(ref, "parentSegmentId");
            String refParentSpanId = text(ref, "parentSpanId");
            if (StringUtils.hasText(parentSegmentId) && StringUtils.hasText(refParentSpanId)) {
                span.parentKey = parentSegmentId + ":" + refParentSpanId;
            }
        }
        return span;
    }

    private TraceTopologyResponse.SpanSummary toSpanSummary(SpanInfo span) {
        TraceTopologyResponse.SpanSummary summary = new TraceTopologyResponse.SpanSummary();
        summary.setSpanKey(span.key);
        summary.setParentSpanKey(span.parentKey);
        summary.setService(span.service);
        summary.setEndpoint(span.endpoint);
        summary.setType(span.type);
        summary.setLayer(span.layer);
        summary.setComponent(span.component);
        summary.setPeer(span.peer);
        summary.setHttpUrl(span.httpUrl);
        summary.setSql(span.sql);
        summary.setTags(span.tags);
        summary.setStartTime(span.startTime);
        summary.setEndTime(span.endTime);
        summary.setDurationMs(span.durationMs);
        summary.setError(span.error);
        summary.setErrorMessage(span.errorMessage);
        return summary;
    }

    private String serviceNodeId(String service) {
        return "svc:" + blankToDefault(service, "unknown-service");
    }

    private String shortUrl(String url) {
        if (!StringUtils.hasText(url)) return "-";
        int protocol = url.indexOf("://");
        int pathStart = protocol >= 0 ? url.indexOf('/', protocol + 3) : -1;
        return pathStart >= 0 ? url.substring(pathStart) : url;
    }

    private String firstText(JsonNode node, String... names) {
        for (String name : names) {
            String value = text(node, name);
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private String text(JsonNode node, String name) {
        JsonNode value = node.path(name);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private Long longValue(JsonNode node, String name) {
        JsonNode value = node.path(name);
        return value.isNumber() ? value.asLong() : null;
    }

    private Map<String, String> tags(JsonNode tagsNode) {
        Map<String, String> tags = new LinkedHashMap<>();
        if (!tagsNode.isArray()) return tags;
        for (JsonNode tag : tagsNode) {
            String key = text(tag, "key");
            String value = text(tag, "value");
            if (StringUtils.hasText(key) && value != null) {
                tags.put(key, value);
            }
        }
        return tags;
    }

    private String firstTag(Map<String, String> tags, String... keys) {
        for (String key : keys) {
            String value = tags.get(key);
            if (StringUtils.hasText(value)) return value;
        }
        for (Map.Entry<String, String> entry : tags.entrySet()) {
            String key = entry.getKey().toLowerCase();
            if ((key.contains("url") || key.contains("uri") || key.contains("statement") || key.equals("sql"))
                    && StringUtils.hasText(entry.getValue())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String extractSpanErrorMessage(JsonNode node, Map<String, String> tags) {
        String tagged = firstTag(tags,
                "error.message", "exception.message", "exception", "stack", "stacktrace", "error", "message",
                "http.status_msg", "db.error");
        if (StringUtils.hasText(tagged)) {
            return tagged;
        }

        String logMessage = extractSpanLogMessage(node.path("logs"));
        if (StringUtils.hasText(logMessage)) {
            return logMessage;
        }

        String eventMessage = extractAttachedEventMessage(node.path("attachedEvents"));
        if (StringUtils.hasText(eventMessage)) {
            return eventMessage;
        }

        return node.path("isError").asBoolean(false) ? "SkyWalking span marked as error" : null;
    }

    private String extractSpanLogMessage(JsonNode logsNode) {
        if (!logsNode.isArray()) return null;
        for (JsonNode logNode : logsNode) {
            Map<String, String> data = tags(logNode.path("data"));
            String message = firstTag(data, "event", "error.kind", "message", "error.message", "stack", "stacktrace");
            if (StringUtils.hasText(message)) {
                return message;
            }
            String joined = joinMapValues(data);
            if (StringUtils.hasText(joined)) {
                return joined;
            }
        }
        return null;
    }

    private String extractAttachedEventMessage(JsonNode eventsNode) {
        if (!eventsNode.isArray()) return null;
        for (JsonNode eventNode : eventsNode) {
            Map<String, String> tags = tags(eventNode.path("tags"));
            Map<String, String> summary = tags(eventNode.path("summary"));
            String eventName = text(eventNode, "event");
            String message = firstTag(tags, "message", "error.message", "exception.message", "stack", "stacktrace");
            if (!StringUtils.hasText(message)) {
                message = firstTag(summary, "message", "error.message", "exception.message", "stack", "stacktrace");
            }
            if (StringUtils.hasText(message)) {
                return StringUtils.hasText(eventName) ? eventName + ": " + message : message;
            }
        }
        return null;
    }

    private String joinMapValues(Map<String, String> values) {
        if (values == null || values.isEmpty()) return null;
        List<String> parts = new ArrayList<>();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (StringUtils.hasText(entry.getValue())) {
                parts.add(entry.getKey() + "=" + entry.getValue());
            }
        }
        return parts.isEmpty() ? null : String.join("; ", parts);
    }

    private String mergeErrorMessage(String current, String next) {
        if (!StringUtils.hasText(next)) return current;
        if (!StringUtils.hasText(current)) return next;
        if (current.contains(next)) return current;
        return current + "\n" + next;
    }

    private String blankToDefault(String value, String defaultValue) {
        return StringUtils.hasText(value) ? value : defaultValue;
    }

    private static class SpanInfo {
        private String key;
        private String parentKey;
        private String segmentId;
        private String spanId;
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
