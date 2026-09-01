package com.smarttesting.platform.service;

import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smarttesting.platform.entity.AiConfig;
import com.smarttesting.platform.entity.ApiExchange;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.entity.RootCauseAnalysis;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import com.smarttesting.platform.mapper.ReportMapper;
import com.smarttesting.platform.mapper.RootCauseAnalysisMapper;
import com.smarttesting.platform.model.RootCauseAnalysisResponse;
import com.smarttesting.platform.model.TraceLogResponse;
import com.smarttesting.platform.model.TraceTopologyResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.Consumer;
import java.util.stream.Collectors;

@Service
public class RootCauseAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(RootCauseAnalysisService.class);
    private static final int MAX_ERROR_EXCHANGES = 8;
    private static final int MAX_LOGS_PER_EXCHANGE = 20;
    private static final int MAX_TEXT = 24000;

    private final RootCauseAnalysisMapper analysisMapper;
    private final ReportMapper reportMapper;
    private final ApiExchangeMapper apiExchangeMapper;
    private final SkyWalkingTraceService skyWalkingTraceService;
    private final AiConfigService aiConfigService;
    private final ApiExchangeControllerSupport apiExchangeControllerSupport;

    public RootCauseAnalysisService(RootCauseAnalysisMapper analysisMapper,
                                    ReportMapper reportMapper,
                                    ApiExchangeMapper apiExchangeMapper,
                                    SkyWalkingTraceService skyWalkingTraceService,
                                    AiConfigService aiConfigService,
                                    com.smarttesting.platform.mapper.ProjectMapper projectMapper) {
        this.analysisMapper = analysisMapper;
        this.reportMapper = reportMapper;
        this.apiExchangeMapper = apiExchangeMapper;
        this.skyWalkingTraceService = skyWalkingTraceService;
        this.aiConfigService = aiConfigService;
        this.apiExchangeControllerSupport = new ApiExchangeControllerSupport(reportMapper, projectMapper);
    }

    public RootCauseAnalysisResponse getAnalysis(Long reportId) {
        Report report = requireReport(reportId);
        List<ApiExchange> errorExchanges = findErrorExchanges(reportId);
        RootCauseAnalysis analysis = analysisMapper.selectLatestByReportId(reportId);

        RootCauseAnalysisResponse response = new RootCauseAnalysisResponse();
        response.setReportId(reportId);
        response.setErrorExchanges(errorExchanges);
        response.setHasBackendError(!errorExchanges.isEmpty());
        response.setCompleted(analysis != null && "COMPLETED".equals(analysis.getStatus()));
        if (analysis != null) {
            response.setStatus(analysis.getStatus());
            response.setModelName(analysis.getModelName());
            response.setReasoning(analysis.getReasoning());
            response.setAnalysis(analysis.getAnalysis());
            response.setErrorMessage(analysis.getErrorMessage());
            response.setUpdatedAt(analysis.getUpdatedAt());
        } else {
            response.setStatus(errorExchanges.isEmpty() ? "NO_BACKEND_ERROR" : "PENDING");
        }
        return response;
    }

    public RootCauseAnalysis analyzeStream(Long reportId, Consumer<String> onReasoning, Consumer<String> onChunk) {
        RootCauseAnalysis cached = analysisMapper.selectLatestByReportId(reportId);
        if (cached != null && "COMPLETED".equals(cached.getStatus())) {
            onReasoning.accept(cached.getReasoning() == null ? "" : cached.getReasoning());
            onChunk.accept(cached.getAnalysis() == null ? "" : cached.getAnalysis());
            return cached;
        }

        Report report = requireReport(reportId);
        List<ApiExchange> errorExchanges = findErrorExchanges(reportId);
        if (errorExchanges.isEmpty()) {
            throw new IllegalStateException("该报告无后端报错接口");
        }

        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null || !StringUtils.hasText(config.getApiKey()) || !StringUtils.hasText(config.getBaseUrl()) || !StringUtils.hasText(config.getModelName())) {
            throw new IllegalStateException("AI configuration is unavailable");
        }

        String prompt = buildPrompt(report, errorExchanges);
        RootCauseAnalysis analysis = new RootCauseAnalysis();
        analysis.setReportId(reportId);
        analysis.setStatus("RUNNING");
        analysis.setModelName(config.getModelName());
        analysis.setPrompt(prompt);
        analysisMapper.insert(analysis);

        StringBuilder reasoning = new StringBuilder();
        StringBuilder content = new StringBuilder();
        try {
            callModelStream(config, prompt,
                    chunk -> {
                        reasoning.append(chunk);
                        onReasoning.accept(chunk);
                    },
                    chunk -> {
                        content.append(chunk);
                        onChunk.accept(chunk);
                    });
            analysis.setStatus("COMPLETED");
            analysis.setReasoning(reasoning.toString());
            analysis.setAnalysis(content.toString());
            analysis.setErrorMessage(null);
            analysisMapper.updateById(analysis);
            return analysis;
        } catch (Exception e) {
            log.error("[RootCauseAnalysis] AI analysis failed: reportId={}", reportId, e);
            analysis.setStatus("FAILED");
            analysis.setReasoning(reasoning.toString());
            analysis.setAnalysis(content.toString());
            analysis.setErrorMessage(e.getMessage());
            analysisMapper.updateById(analysis);
            throw new IllegalStateException("AI root cause analysis failed: " + e.getMessage(), e);
        }
    }

    private Report requireReport(Long reportId) {
        Report report = reportMapper.selectById(reportId);
        if (report == null) {
            throw new IllegalArgumentException("Report not found: " + reportId);
        }
        return report;
    }

    private List<ApiExchange> findErrorExchanges(Long reportId) {
        return apiExchangeMapper.selectByReportId(reportId).stream()
                .filter(exchange -> StringUtils.hasText(exchange.getErrorMessage()) || (exchange.getStatusCode() != null && exchange.getStatusCode() >= 500))
                .sorted(Comparator.comparing(ApiExchange::getStartedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(MAX_ERROR_EXCHANGES)
                .collect(Collectors.toList());
    }

    private String buildPrompt(Report report, List<ApiExchange> errorExchanges) {
        StringBuilder context = new StringBuilder();
        context.append("你是资深测试平台故障根因分析专家。请结合 UI 自动化测试报告、失败接口、SkyWalking 链路和日志，给出本次失败的根因分析。\n");
        context.append("输出要求：\n");
        context.append("1. 先给出最可能根因，说明置信度。\n");
        context.append("2. 列出证据链，明确引用接口、状态码、traceId、错误日志、异常 span。\n");
        context.append("3. 区分直接原因、上游触发条件和潜在系统性问题。\n");
        context.append("4. 给出排查建议和修复建议。\n");
        context.append("5. 如果证据不足，明确说明缺口，不要编造。\n\n");
        context.append("报告信息：\n");
        context.append("- reportId: ").append(report.getId()).append('\n');
        context.append("- name: ").append(nullToDash(report.getName())).append('\n');
        context.append("- status: ").append(nullToDash(report.getStatus())).append('\n');
        context.append("- caseId: ").append(nullToDash(report.getCaseId())).append('\n');
        context.append("- url: ").append(nullToDash(report.getUrl())).append('\n');
        context.append("- reportError: ").append(trim(report.getError(), 2000)).append("\n\n");

        for (ApiExchange exchange : errorExchanges) {
            context.append("失败接口：\n");
            context.append("- id: ").append(exchange.getId()).append('\n');
            context.append("- method: ").append(nullToDash(exchange.getMethod())).append('\n');
            context.append("- url: ").append(nullToDash(exchange.getUrl())).append('\n');
            context.append("- statusCode: ").append(exchange.getStatusCode()).append('\n');
            context.append("- durationMs: ").append(exchange.getDurationMs()).append('\n');
            context.append("- traceId: ").append(nullToDash(exchange.getTraceId())).append('\n');
            context.append("- exchangeError: ").append(trim(exchange.getErrorMessage(), 2000)).append('\n');

            String skywalkingUrl = apiExchangeControllerSupport.resolveSkywalkingUrl(exchange);
            TraceTopologyResponse topology = skyWalkingTraceService.getTopology(exchange, skywalkingUrl);
            context.append("Trace Topology Summary:\n");
            context.append("- traceError: ").append(nullToDash(topology.getErrorMessage())).append('\n');
            topology.getSpans().stream()
                    .filter(span -> Boolean.TRUE.equals(span.getError()))
                    .limit(20)
                    .forEach(span -> context.append("  - errorSpan service=").append(nullToDash(span.getService()))
                            .append(", endpoint=").append(nullToDash(span.getEndpoint()))
                            .append(", type=").append(nullToDash(span.getType()))
                            .append(", layer=").append(nullToDash(span.getLayer()))
                            .append(", component=").append(nullToDash(span.getComponent()))
                            .append(", peer=").append(nullToDash(span.getPeer()))
                            .append(", durationMs=").append(span.getDurationMs())
                            .append(", error=").append(trim(span.getErrorMessage(), 1200))
                            .append('\n'));

            TraceLogResponse logs = skyWalkingTraceService.getLogs(exchange, skywalkingUrl);
            context.append("Trace Logs:\n");
            context.append("- logQueryError: ").append(nullToDash(logs.getErrorMessage())).append('\n');
            logs.getLogs().stream()
                    .filter(log -> isErrorLog(log.getLevel(), log.getContent()))
                    .limit(MAX_LOGS_PER_EXCHANGE)
                    .forEach(log -> context.append("  - [").append(nullToDash(log.getLevel())).append("] ")
                            .append(nullToDash(log.getService())).append(" ")
                            .append(trim(log.getContent(), 1800)).append('\n'));
            context.append('\n');
        }
        return trim(context.toString(), MAX_TEXT);
    }

    private void callModelStream(AiConfig config, String prompt, Consumer<String> onReasoning, Consumer<String> onChunk) throws Exception {
        JSONObject body = new JSONObject();
        body.set("model", config.getModelName());
        body.set("temperature", 0.2);
        body.set("stream", true);
        JSONArray messages = new JSONArray();
        messages.add(new JSONObject().set("role", "system").set("content", "你是严谨的软件故障根因分析专家。只基于用户提供的证据分析，输出中文 Markdown。"));
        messages.add(new JSONObject().set("role", "user").set("content", prompt));
        body.set("messages", messages);

        String apiUrl = config.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
        HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl).openConnection();
        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(180000);
        connection.setRequestProperty("Authorization", "Bearer " + config.getApiKey());
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "text/event-stream");
        byte[] requestBody = body.toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(requestBody.length);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(requestBody);
            output.flush();
        }
        int status = connection.getResponseCode();
        if (status < 200 || status >= 300) {
            throw new IllegalStateException("AI request failed: HTTP " + status);
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data:")) continue;
                String data = line.substring(5).trim();
                if ("[DONE]".equals(data)) break;
                JSONObject delta = JSONUtil.parseObj(data).getJSONArray("choices").getJSONObject(0).getJSONObject("delta");
                String reasoning = delta.getStr("reasoning_content");
                if (StringUtils.hasText(reasoning)) onReasoning.accept(reasoning);
                String chunk = delta.getStr("content");
                if (StringUtils.hasText(chunk)) onChunk.accept(chunk);
            }
        } finally {
            connection.disconnect();
        }
    }

    private boolean isErrorLog(String level, String content) {
        String text = (nullToDash(level) + " " + nullToDash(content)).toLowerCase();
        return text.contains("error") || text.contains("exception") || text.contains("failed") || text.contains("fatal") || text.contains("warn");
    }

    private String nullToDash(String value) {
        return StringUtils.hasText(value) ? value : "-";
    }

    private String trim(String value, int maxLength) {
        if (value == null) return "";
        if (value.length() <= maxLength) return value;
        return value.substring(0, maxLength) + "...<truncated>";
    }

    private static class ApiExchangeControllerSupport {
        private final ReportMapper reportMapper;
        private final com.smarttesting.platform.mapper.ProjectMapper projectMapper;

        private ApiExchangeControllerSupport(ReportMapper reportMapper, com.smarttesting.platform.mapper.ProjectMapper projectMapper) {
            this.reportMapper = reportMapper;
            this.projectMapper = projectMapper;
        }

        private String resolveSkywalkingUrl(ApiExchange exchange) {
            if (exchange.getReportId() == null) return null;
            Report report = reportMapper.selectById(exchange.getReportId());
            if (report == null || report.getProjectId() == null) return null;
            com.smarttesting.platform.entity.Project project = projectMapper.selectById(report.getProjectId());
            return project == null ? null : project.getSkywalkingGraphqlUrl();
        }
    }
}
