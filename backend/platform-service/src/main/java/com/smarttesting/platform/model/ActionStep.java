package com.smarttesting.platform.model;

/**
 * AI 模型输出的单个 action 步骤
 */
public class ActionStep {

    private String type;   // ai | aiTap | aiInput | aiAssert | sleep | aiWaitFor | aiScroll | aiHover | aiQuery
    private String prompt; // 操作描述（aiInput 时为元素定位描述，如"搜索框"）
    private String value;  // aiInput 的输入值 / sleep 的毫秒数
    private Boolean dynamic; // 动态内容（验证码/日期/随机值等）→ 生成 YAML 时输出 cacheable: false

    public ActionStep() {}

    public ActionStep(String type, String prompt) {
        this.type = type;
        this.prompt = prompt;
    }

    public ActionStep(String type, String prompt, Boolean dynamic) {
        this.type = type;
        this.prompt = prompt;
        this.dynamic = dynamic;
    }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getPrompt() { return prompt; }
    public void setPrompt(String prompt) { this.prompt = prompt; }

    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }

    public Boolean getDynamic() { return dynamic; }
    public void setDynamic(Boolean dynamic) { this.dynamic = dynamic; }
}
