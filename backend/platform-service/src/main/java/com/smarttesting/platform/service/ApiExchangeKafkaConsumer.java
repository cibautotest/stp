package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttesting.platform.entity.ApiExchange;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Map;

@Service
@ConditionalOnProperty(prefix = "observability.kafka", name = "enabled", havingValue = "true")
public class ApiExchangeKafkaConsumer {
    private static final Logger log = LoggerFactory.getLogger(ApiExchangeKafkaConsumer.class);

    private final ObjectMapper mapper = new ObjectMapper();
    private final ApiExchangeMapper dao;

    public ApiExchangeKafkaConsumer(ApiExchangeMapper dao) {
        this.dao = dao;
    }

    @KafkaListener(topics = "${observability.kafka.topic:ui-test-api-exchange.v1}", groupId = "${observability.kafka.group-id:platform-api-exchange}")
    public void consume(String payload) {
        try {
            Map<?, ?> event = mapper.readValue(payload, Map.class);
            String requestId = String.valueOf(event.get("requestId"));
            String executionId = String.valueOf(event.get("executionId"));

            if (dao.selectByExecutionIdAndRequestId(executionId, requestId) != null) {
                return;
            }

            Map<?, ?> request = (Map<?, ?>) event.get("request");
            Map<?, ?> response = (Map<?, ?>) event.get("response");
            if (request == null) {
                throw new IllegalArgumentException("missing request");
            }

            ApiExchange exchange = new ApiExchange();
            exchange.setRequestId(requestId);
            exchange.setExecutionId(executionId);
            exchange.setCaseId(String.valueOf(event.get("caseId")));
            if (event.get("reportId") instanceof Number) {
                exchange.setReportId(((Number) event.get("reportId")).longValue());
            }
            exchange.setTraceId(String.valueOf(event.get("traceId")));
            exchange.setSegmentId(String.valueOf(event.get("segmentId")));
            exchange.setMethod(String.valueOf(request.get("method")));
            exchange.setUrl(String.valueOf(request.get("url")));
            exchange.setResourceType(String.valueOf(request.get("resourceType")));
            exchange.setRequestHeaders(mapper.writeValueAsString(request.get("headers")));
            exchange.setRequestBodyBase64((String) request.get("bodyBase64"));
            exchange.setRequestBodyTruncated(Boolean.TRUE.equals(request.get("bodyTruncated")));

            if (response != null) {
                exchange.setStatusCode(response.get("status") == null ? null : ((Number) response.get("status")).intValue());
                exchange.setDurationMs(response.get("durationMs") == null ? null : ((Number) response.get("durationMs")).longValue());
                exchange.setContentType((String) response.get("contentType"));
                exchange.setResponseHeaders(mapper.writeValueAsString(response.get("headers")));
                exchange.setResponseBodyBase64((String) response.get("bodyBase64"));
                exchange.setResponseBodyTruncated(Boolean.TRUE.equals(response.get("bodyTruncated")));
            }

            exchange.setErrorMessage((String) event.get("error"));
            exchange.setStartedAt(parse((String) request.get("startedAt")));
            exchange.setCompletedAt(parse((String) event.get("completedAt")));
            dao.insert(exchange);
        } catch (Exception ex) {
            log.warn("Failed to consume API exchange Kafka event", ex);
        }
    }

    private LocalDateTime parse(String value) {
        return value == null ? null : OffsetDateTime.parse(value).toLocalDateTime();
    }
}
