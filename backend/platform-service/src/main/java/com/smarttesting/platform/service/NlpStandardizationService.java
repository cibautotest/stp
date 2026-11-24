package com.smarttesting.platform.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.json.JSONArray;
import cn.hutool.json.JSONObject;
import cn.hutool.json.JSONUtil;
import com.smarttesting.platform.entity.AiConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.regex.Pattern;

/**
 * NLP 标准化服务
 * 将用户/插件传入的非标准用例步骤（口语化、多动作混一句）标准化为清晰的分步描述，
 * 并为动态内容（验证码/滑块/点选/当前日期/随机值等）追加 [动态] 标签——
 * 执行引擎据此禁用 plan 缓存（缓存值必然过期）。
 *
 * AI 不可用时静默降级：返回原文（带本地关键词兜底标记）。
 */
@Service
public class NlpStandardizationService {

    private static final Logger log = LoggerFactory.getLogger(NlpStandardizationService.class);

    @Resource
    private AiConfigService aiConfigService;

    /** 动态内容关键词（与执行引擎 hasDynamicContent 保持一致） */
    private static final Pattern DYNAMIC_KEYWORD = Pattern.compile(
            "验证码|captcha|滑块|滑动验证|点选|图形码"
                    + "|短信.{0,4}(码|验证)|邮箱.{0,4}(码|验证)|邮件.{0,4}(码|验证)"
                    + "|动态(密码|口令|值)|一次性(密码|口令|验证)"
                    + "|随机(数|码|值)|验证字符"
                    + "|当前日期|今天日期|当日日期|当前时间|时间戳|uuid",
            Pattern.CASE_INSENSITIVE);

    /**
     * 标准化 NLP：优先调 AI 拆解标准化；失败降级为本地关键词标记。
     * @return 标准化后的 NLP（每行一个步骤；动态步骤行首带 [动态]）
     */
    public String standardize(String nlp) {
        if (nlp == null || nlp.isBlank()) return nlp;
        String cleaned = nlp.trim();

        // 已含显式动态标签的输入：不再调 AI（结构已标准），仅统一标签格式为【动态】并给未标记的动态行补标
        if (cleaned.contains("[动态]") || cleaned.contains("【动态】")) {
            return markDynamicLocally(cleaned);
        }

        try {
            String aiResult = standardizeByAi(cleaned);
            if (aiResult != null && !aiResult.isBlank()) {
                return aiResult.trim();
            }
        } catch (Exception e) {
            log.warn("[NlpStandardize] AI 标准化失败，降级为本地关键词标记: {}", e.getMessage());
        }
        // 降级：按行拆分 + 关键词标记
        return markDynamicLocally(cleaned);
    }

    /** 调用大模型标准化：口语化输入 → 每行一个标准步骤；动态步骤行首加 [动态] */
    private String standardizeByAi(String nlp) {
        AiConfig config = aiConfigService.getCurrentConfig();
        if (config == null || config.getApiKey() == null || config.getApiKey().isBlank()) {
            return null;
        }
        JSONObject body = new JSONObject();
        body.set("model", config.getModelName());
        body.set("temperature", 0.1);
        JSONArray messages = new JSONArray();
        messages.add(new JSONObject().set("role", "system").set("content",
                "你是 UI 测试用例步骤标准化器。把用户输入的口语化/非标准测试步骤改写为标准化的分步列表：\n" +
                "1. 每行一个步骤，只表达一件事（打开页面 / 在X输入Y / 点击Z / 断言A / 等待B）。\n" +
                "2. 模糊指代（\"那个按钮\"\"这个输入框\"）按上下文推断为具体元素名。\n" +
                "3. 动态内容判定：若步骤涉及验证码（图形/数字计算/点选/滑块）、短信码、动态密码、随机数、当前日期/时间等每次执行都变的内容，在该动态值/对象前插入内联标记【动态】。\n" +
                "   示例：输入第一个【动态】普通验证码 / 输入【动态】短信验证码 / 输入【动态】当前日期。\n" +
                "   注意：标记只贴在动态值前面，不要放在行首罩住整步；一行内多个动态值可分别标注（如：输入第一个【动态】普通验证码，输入第二个【动态】数字计算验证码）。\n" +
                "4. 固定内容（固定账号、密码、菜单名、按钮名、查询词）不加任何标记。\n" +
                "5. 保留原有网址；不要增删步骤，不要解释。\n" +
                "文件操作步骤规范格式：\n" +
                "   上传 → 上传文件 <完整路径> 到<上传控件描述>（如：上传文件 C:\\test\\demo.pdf 到上传按钮）\n" +
                "   下载 → 下载<文件描述>（如：下载报表文件）\n" +
                "   断言 → 断言下载文件内容包含\"<文本>\" 或 断言下载文件名包含\"<片段>\"\n" +
                "输出格式：纯文本步骤列表，每行一步。"));
        messages.add(new JSONObject().set("role", "user").set("content", nlp));
        body.set("messages", messages);

        String apiUrl = config.getBaseUrl().replaceAll("/+$", "") + "/chat/completions";
        HttpResponse response = HttpRequest.post(apiUrl)
                .header("Authorization", "Bearer " + config.getApiKey())
                .header("Content-Type", "application/json")
                .body(body.toString())
                .timeout(60000)
                .execute();
        if (!response.isOk()) {
            log.warn("[NlpStandardize] AI HTTP {}: {}", response.getStatus(), response.body());
            return null;
        }
        String content = JSONUtil.parseObj(response.body()).getJSONArray("choices").getJSONObject(0)
                .getJSONObject("message").getStr("content");
        if (content == null || content.isBlank()) return null;
        String cleaned = content.trim()
                .replaceFirst("^```(?:text|markdown)?\\s*", "")
                .replaceFirst("\\s*```$", "")
                .replaceFirst("^\\d+[.、)]\\s*", "");
        // 每行去掉序号前缀（AI 可能带序号输出）
        StringBuilder sb = new StringBuilder();
        for (String line : cleaned.split("\n")) {
            String l = line.trim().replaceFirst("^[-*]?\\s*\\d+[.、)]\\s*", "");
            if (!l.isEmpty()) sb.append(l).append("\n");
        }
        return sb.length() > 0 ? sb.toString().trim() : null;
    }

    /**
     * 本地降级：按行处理；无标签的行按中文逗号/分号拆成子句（每子句一行），
     * 动态关键词命中的子句在关键词前插入内联标记【动态】；已有标签的行原样保留。
     */
    private String markDynamicLocally(String nlp) {
        StringBuilder sb = new StringBuilder();
        for (String line : nlp.split("\n")) {
            String l = line.trim();
            if (l.isEmpty()) continue;
            boolean hasTag = l.contains("[动态]") || l.contains("【动态】");
            if (hasTag) {
                // 已有标签（内联或行首）：保留（统一为【动态】格式）；引擎按整行检测标签即可
                sb.append(l.replace("[动态]", "【动态】")).append("\n");
                continue;
            }
            // 逗号/分号连写的多动作行：拆成子句，每子句一行，动态子句独立标注
            String[] clauses = l.split("[，；]");
            for (String clause : clauses) {
                String c = clause.trim();
                if (c.isEmpty()) continue;
                java.util.regex.Matcher m = DYNAMIC_KEYWORD.matcher(c);
                if (m.find()) {
                    sb.append(new StringBuilder(c).insert(m.start(), "【动态】")).append("\n");
                } else {
                    sb.append(c).append("\n");
                }
            }
        }
        return sb.length() > 0 ? sb.toString().trim() : nlp;
    }

}
