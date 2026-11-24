package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 最终下发执行机的 Midscene 脚本预览
 * 与 CaseExecutionService.buildExecuteRequest 组装结果一致（执行与预览共用一条代码路径）
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Preview of the final Midscene script dispatched to execute service")
public class FinalScriptPreview {

    @Schema(description = "Final execution mode: NLP / YAML", allowableValues = {"NLP", "YAML"})
    private String executionMode;

    @Schema(description = "Final business YAML script (login task stripped when a login method is bound)", maxLength = 200000)
    private String yamlScript;

    @Schema(description = "Final business NLP (legacy login prefix stripped)", maxLength = 20000)
    private String nlp;

    @Schema(description = "Recorded Playwright script dispatched in CODE mode (null for NLP/YAML)", maxLength = 200000)
    private String script;

    @Schema(description = "Recorded script status: NONE / RECORDED / STALE", allowableValues = {"NONE", "RECORDED", "STALE"})
    private String scriptStatus;

    @Schema(description = "Target page URL extracted from YAML for NLP mode", maxLength = 1000)
    private String targetUrl;

    @Schema(description = "Headless mode dispatched by default")
    private Boolean headless;

    @Schema(description = "Timeout in milliseconds dispatched by default")
    private Integer timeout;

    @Schema(description = "Login method payload dispatched to execute service (null means no login)")
    private ExecuteRequest.LoginMethodPayload loginMethod;

    @Schema(description = "Login stage YAML preview assembled by execute-service template", maxLength = 200000)
    private String loginYamlPreview;

    @Schema(description = "Warnings for missing content (e.g. yamlFlow not generated, execution would be rejected)")
    private List<String> warnings;
}
