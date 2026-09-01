package com.smarttesting.platform.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smarttesting.platform.entity.AiConfig;
import com.smarttesting.platform.model.ActionStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.OutputStream;

/**
 * YAML 脚本生成服务 (对应规范: yaml-script-generation)
 * 将自然语言测试步骤转换为 Midscene 兼容的 YAML 任务流
 *
 * 改造：调用 AI 模型智能拆解 NLP 步骤并匹配最合适的 Midscene action 类型
 */
@Service
public class YamlGeneratorService {

    private static final Logger log = LoggerFactory.getLogger(YamlGeneratorService.class);

    private static final Pattern URL_PATTERN = Pattern.compile(
            "https?://[^\\s，,，\\u4e00-\\u9fa5]+"
    );

    @Resource
    private AiConfigService aiConfigService;

    /**
     * 从 NLP 文本中提取 URL
     */
    public String extractUrl(String nlp) {
        if (nlp == null || nlp.isBlank()) {
            return null;
        }
        Matcher matcher = URL_PATTERN.matcher(nlp);
        return matcher.find() ? matcher.group() : null;
    }

    /**
     * 从 NLP 文本生成 Midscene YAML 任务流
     * 调用 AI 模型智能拆解步骤 + 匹配最合适的 action 类型
     */
    public String generateYaml(String nlp) {
        if (nlp == null || nlp.isBlank()) {
            throw new IllegalArgumentException("NLP instruction must not be empty");
        }
        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new IllegalStateException("AI configuration is unavailable");
        }
        try {
            JSONObject body = new JSONObject();
            body.set("model", config.getModelName());
            body.set("temperature", 0.1);
            JSONArray messages = new JSONArray();
            JSONObject system = new JSONObject();
            system.set("role", "system");
            system.set("content", "You generate executable Midscene YAML. Return ONLY valid YAML, without markdown fences. Include web.url if the instruction contains a URL. Include exactly one tasks item and a flow of Midscene actions (ai, aiTap, aiInput, aiAssert, aiWaitFor, aiScroll, aiHover, sleep). Preserve the user's intent exactly.");
            messages.add(system);
            JSONObject user = new JSONObject();
            user.set("role", "user");
            user.set("content", nlp);
            messages.add(user);
            body.set("messages", messages);
            String apiUrl = config.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
            HttpResponse response = HttpRequest.post(apiUrl).header("Authorization", "Bearer " + config.getApiKey())
                    .header("Content-Type", "application/json").body(body.toString()).timeout(60000).execute();
            if (!response.isOk()) throw new IllegalStateException("AI request failed: HTTP " + response.getStatus());
            String content = JSONUtil.parseObj(response.body()).getJSONArray("choices").getJSONObject(0)
                    .getJSONObject("message").getStr("content");
            String yaml = content == null ? "" : content.trim().replaceFirst("^```(?:yaml)?\\s*", "").replaceFirst("\\s*```$", "");
            if (!yaml.contains("tasks:")) throw new IllegalStateException("AI did not return a valid Midscene YAML script");
            return yaml;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("AI YAML generation failed: " + e.getMessage(), e);
        }
    }

    /** Streams the model response and returns the complete response after the stream ends. */
    public String generateYamlStream(String nlp, Consumer<String> onReasoning, Consumer<String> onChunk) {
        if (nlp == null || nlp.isBlank()) throw new IllegalArgumentException("NLP instruction must not be empty");
        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) throw new IllegalStateException("AI configuration is unavailable");
        try {
            JSONObject body = new JSONObject();
            body.set("model", config.getModelName()); body.set("temperature", 0.1); body.set("stream", true);
            JSONArray messages = new JSONArray();
            messages.add(new JSONObject().set("role", "system").set("content", "You generate executable Midscene YAML. Return ONLY valid YAML, without markdown fences. Include web.url if the instruction contains a URL. Include exactly one tasks item and a flow of Midscene actions (ai, aiTap, aiInput, aiAssert, aiWaitFor, aiScroll, aiHover, sleep). Preserve the user's intent exactly."));
            messages.add(new JSONObject().set("role", "user").set("content", nlp)); body.set("messages", messages);
            String apiUrl = config.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
            StringBuilder complete = new StringBuilder();
            HttpURLConnection connection = (HttpURLConnection) new URL(apiUrl).openConnection();
            connection.setRequestMethod("POST"); connection.setDoOutput(true); connection.setConnectTimeout(15000); connection.setReadTimeout(120000);
            connection.setRequestProperty("Authorization", "Bearer " + config.getApiKey()); connection.setRequestProperty("Content-Type", "application/json; charset=utf-8"); connection.setRequestProperty("Accept", "text/event-stream");
            byte[] requestBody = body.toString().getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(requestBody.length);
            try (OutputStream output = connection.getOutputStream()) { output.write(requestBody); output.flush(); }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IllegalStateException("AI request failed: HTTP " + status);
            log.info("[YamlStream] upstream connected: model={}, HTTP={}", config.getModelName(), status);
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.startsWith("data:")) { if (!line.isBlank()) log.debug("[YamlStream] upstream line: {}", line); continue; }
                    String data = line.substring(5).trim(); if ("[DONE]".equals(data)) break;
                    try {
                        JSONObject delta = JSONUtil.parseObj(data).getJSONArray("choices").getJSONObject(0).getJSONObject("delta");
                        String reasoning = delta.getStr("reasoning_content");
                        if (reasoning != null && !reasoning.isEmpty()) {
                            onReasoning.accept(reasoning);
                        }
                        String chunk = delta.getStr("content");
                        if (chunk != null && !chunk.isEmpty()) {
                            complete.append(chunk);
                            onChunk.accept(chunk);
                        }
                    } catch (Exception e) { log.debug("[YamlStream] ignored upstream event: {}", data, e); }
                }
            } finally {
                connection.disconnect();
            }
            String yaml = complete.toString().trim().replaceFirst("^```(?:yaml)?\\s*", "").replaceFirst("\\s*```$", "");
            if (!yaml.contains("tasks:")) throw new IllegalStateException("AI did not return a valid Midscene YAML script");
            return yaml;
        } catch (IllegalStateException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("AI YAML generation failed: " + e.getMessage(), e); }
    }

    /**
     * 智能拆解 NLP 为 ActionStep 列表（本地解析 + AI 降级）
     */
    public List<ActionStep> nlpToActions(String nlp) {
        // Step 1: 按中文逗号拆分为独立步骤
        String[] segments = nlp.split("，");
        List<ActionStep> steps = new ArrayList<>();
        boolean hasUrl = false;

        for (String seg : segments) {
            String s = seg.trim();
            if (s.isEmpty()) continue;

            if (s.startsWith("打开") || s.startsWith("访问") || s.startsWith("进入") || s.startsWith("浏览")) {
                // URL 导航 → ai
                steps.add(new ActionStep("ai", s));
                hasUrl = true;

            } else if (s.startsWith("输入") || s.startsWith("键入") || s.startsWith("填写") || s.startsWith("填入")) {
                // 输入操作 → aiInput (拆 prompt + value)
                String inputValue = extractInputValue(s);
                ActionStep step = new ActionStep("aiInput", "搜索输入框");
                step.setValue(inputValue);
                steps.add(step);

            } else if (s.startsWith("点击") || s.startsWith("单击") || s.startsWith("按下")) {
                // 点击操作 → aiTap
                String target = s.replaceAll("^(点击|单击|按下)", "").trim();
                if (target.isEmpty()) target = s;
                steps.add(new ActionStep("aiTap", target));

            } else if (s.startsWith("断言") || s.startsWith("验证") || s.startsWith("检查") || s.startsWith("确认")) {
                // 断言操作 → aiAssert
                steps.add(new ActionStep("aiAssert", s));

            } else if (s.startsWith("等待")) {
                ActionStep step = new ActionStep("sleep", "3000");
                step.setValue("3000");
                steps.add(step);

            } else if (s.startsWith("滚动") || s.startsWith("拖动") || s.startsWith("拖拽") || s.startsWith("下滑") || s.startsWith("上滑")) {
                steps.add(new ActionStep("aiScroll", s));

            } else if (s.startsWith("悬停")) {
                steps.add(new ActionStep("aiHover", s));

            } else {
                // 未匹配的片段 → 尝试 AI
                ActionStep aiStep = tryAiSplit(s);
                if (aiStep != null) {
                    steps.add(aiStep);
                } else {
                    steps.add(new ActionStep("ai", s));
                }
            }
        }

        // 如果没有任何 URL → 在开头插入 url 打开步骤
        if (!hasUrl && steps.size() >= 1) {
            steps.add(0, new ActionStep("ai", "打开" + nlp));
        }

        log.info("[YamlGen] Split NLP into {} steps", steps.size());
        return steps.isEmpty() ? fallbackActions(nlp) : steps;
    }

    /**
     * 从"输入 xxx"中提取输入值
     */
    private String extractInputValue(String text) {
        return text.replaceAll("^(输入|键入|填写|填入)\\s*", "").trim();
    }

    /**
     * 尝试用 AI 识别单个未匹配片段
     */
    private ActionStep tryAiSplit(String segment) {
        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            return null;
        }
        try {
            JSONObject body = new JSONObject();
            body.set("model", config.getModelName());
            JSONArray messages = new JSONArray();
            JSONObject userMsg = new JSONObject();
            userMsg.set("role", "user");
            userMsg.set("content", "Classify this step: \"" + segment + "\". Reply with ONLY one JSON: {\"type\":\"ai|aiTap|aiInput|aiAssert|aiWaitFor|aiScroll|aiHover|sleep\",\"prompt\":\"...\"} (include \"value\" for aiInput)");
            messages.add(userMsg);
            body.set("messages", messages);
            body.set("max_tokens", 200);

            String apiUrl = config.getBaseUrl();
            if (!apiUrl.endsWith("/")) apiUrl += "/";
            apiUrl += "chat/completions";

            HttpResponse response = HttpRequest.post(apiUrl)
                    .header("Authorization", "Bearer " + config.getApiKey())
                    .header("Content-Type", "application/json")
                    .body(body.toString())
                    .timeout(15000)
                    .execute();

            if (response.isOk()) {
                JSONObject resp = JSONUtil.parseObj(response.body());
                String content = resp.getJSONArray("choices").getJSONObject(0).getJSONObject("message").getStr("content").trim();
                JSONObject item = JSONUtil.parseObj(content);
                ActionStep step = new ActionStep();
                step.setType(item.getStr("type", "ai"));
                step.setPrompt(item.getStr("prompt", segment));
                if (item.containsKey("value")) step.setValue(item.getStr("value"));
                return step;
            }
        } catch (Exception ignored) {}
        return null;
    }

    /**
     * 降级：整段 NLP 作为一个 ai: action
     */
    private List<ActionStep> fallbackActions(String nlp) {
        ActionStep step = new ActionStep("ai", nlp);
        return Collections.singletonList(step);
    }

    /**
     * ActionStep 列表 → YAML 字符串
     */
    private String actionsToYaml(List<ActionStep> steps) {
        StringBuilder yaml = new StringBuilder();
        yaml.append("tasks:\n");
        yaml.append("  - name: AI 测试\n");
        yaml.append("    flow:\n");

        for (ActionStep step : steps) {
            if ("sleep".equals(step.getType())) {
                // sleep: use value as milliseconds
                String ms = step.getValue() != null ? step.getValue() : "3000";
                yaml.append("      - sleep: ").append(ms).append("\n");
            } else {
                yaml.append("      - ").append(step.getType()).append(": ").append(escapeYaml(step.getPrompt())).append("\n");
            }
            // aiInput with value: add value on next line
            if ("aiInput".equals(step.getType()) && step.getValue() != null && !step.getValue().isBlank()) {
                yaml.append("        value: ").append(escapeYaml(step.getValue())).append("\n");
            }
        }
        return yaml.toString();
    }

    /**
     * 验证 YAML 格式是否有效
     */
    public YamlValidationResult validate(String yaml) {
        if (yaml == null || yaml.isBlank()) {
            return YamlValidationResult.error("YAML content is empty");
        }
        if (!yaml.contains("tasks:")) {
            return YamlValidationResult.error("YAML must contain 'tasks' array");
        }
        return YamlValidationResult.success();
    }

    private String escapeYaml(String text) {
        if (text == null) return "";
        return text.replace("'", "''");
    }

    /**
     * YAML 验证结果
     */
    public static class YamlValidationResult {
        private final boolean valid;
        private final String message;

        private YamlValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }

        public static YamlValidationResult success() {
            return new YamlValidationResult(true, "OK");
        }

        public static YamlValidationResult error(String message) {
            return new YamlValidationResult(false, message);
        }

        public boolean isValid() { return valid; }
        public String getMessage() { return message; }
    }
}
