package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.LoginMethod;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.model.ExecuteRequest;
import com.smarttesting.platform.model.FinalScriptPreview;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * CaseExecutionService 纯逻辑单测（示例：red-green 节奏）
 * 覆盖点：stripLoginTask（剔除登录 task）、extractWebUrl（提取目标网址）、
 * previewFinalScript（最终脚本预览：与执行链路共用 buildExecuteRequest）、
 * buildLoginYamlPreview（登录 YAML 模板，与执行机 yaml-runner.ts buildLoginYaml 同步）
 */
@ExtendWith(MockitoExtension.class)
class CaseExecutionServiceTest {

    @InjectMocks
    private CaseExecutionService service;

    @Mock
    private TestCaseService testCaseService;

    @Mock
    private LoginMethodService loginMethodService;

    @Mock
    private ProjectExecutionSettingsService projectExecutionSettingsService;

    /** 反射调用 private 方法 */
    private String invokeStringMethod(String name, String arg) throws Exception {
        Method m = CaseExecutionService.class.getDeclaredMethod(name, String.class);
        m.setAccessible(true);
        return (String) m.invoke(service, arg);
    }

    private TestCase buildCase(String id, String mode, String nlp, String yamlFlow, String loginMethodId) {
        TestCase tc = new TestCase();
        tc.setId(id);
        tc.setName("用例-" + id);
        tc.setExecutionMode(mode);
        tc.setNlp(nlp);
        tc.setYamlFlow(yamlFlow);
        tc.setLoginMethodId(loginMethodId);
        return tc;
    }

    private LoginMethod buildLocalLogin(String id) {
        LoginMethod lm = new LoginMethod();
        lm.setId(id);
        lm.setType("local");
        lm.setLoginUrl("https://sso.example.com/login");
        lm.setUsername("admin");
        lm.setPassword("p'w");
        lm.setStepsNlp("[动态] 输入验证码 1234\n关闭升级提示弹窗");
        return lm;
    }

    // ── stripLoginTask ──────────────────────────────────────────

    @Test
    @DisplayName("stripLoginTask: 多 task 时剔除 name 以「登录」开头的 task")
    void stripLoginTask_removesLoginTask() throws Exception {
        String yaml = "web:\n  url: https://sso.example.com/login\ntasks:\n"
                + "  - name: 登录\n    flow:\n      - aiInput: 'admin'\n"
                + "  - name: 查询订单\n    flow:\n      - aiTap: 订单菜单\n";
        String result = invokeStringMethod("stripLoginTask", yaml);
        assertThat(result).contains("查询订单");
        assertThat(result).doesNotContain("name: 登录");
    }

    @Test
    @DisplayName("stripLoginTask: 仅剩登录 task 时原样返回（避免空 tasks）")
    void stripLoginTask_keepsSingleLoginTask() throws Exception {
        String yaml = "tasks:\n  - name: 登录\n    flow:\n      - aiInput: 'admin'\n";
        String result = invokeStringMethod("stripLoginTask", yaml);
        assertThat(result).isEqualTo(yaml);
    }

    @Test
    @DisplayName("stripLoginTask: 无登录 task 时原样返回")
    void stripLoginTask_noLoginTask() throws Exception {
        String yaml = "tasks:\n  - name: 查询订单\n    flow:\n      - aiTap: 订单菜单\n";
        String result = invokeStringMethod("stripLoginTask", yaml);
        assertThat(result).isEqualTo(yaml);
    }

    @Test
    @DisplayName("stripLoginTask: 空输入安全返回")
    void stripLoginTask_blankInput() throws Exception {
        assertThat(invokeStringMethod("stripLoginTask", null)).isNull();
        assertThat(invokeStringMethod("stripLoginTask", "")).isEmpty();
    }

    // ── extractWebUrl ───────────────────────────────────────────

    @Test
    @DisplayName("extractWebUrl: 从 YAML 中提取 web.url")
    void extractWebUrl_found() throws Exception {
        String yaml = "web:\n  url: https://www.example.com/path\ntasks:\n  - name: t\n";
        assertThat(invokeStringMethod("extractWebUrl", yaml))
                .isEqualTo("https://www.example.com/path");
    }

    @Test
    @DisplayName("extractWebUrl: 无 URL 或空输入返回 null")
    void extractWebUrl_notFound() throws Exception {
        assertThat(invokeStringMethod("extractWebUrl", "tasks:\n  - name: t\n")).isNull();
        assertThat(invokeStringMethod("extractWebUrl", null)).isNull();
        assertThat(invokeStringMethod("extractWebUrl", "  ")).isNull();
    }

    // ── previewFinalScript（最终脚本预览，与执行链路共用 buildExecuteRequest） ──

    @Test
    @DisplayName("预览: YAML 模式 + 绑定登录方式 → 剔除登录 task + 注入登录负载 + 登录 YAML 模板预览")
    void previewFinalScript_yamlMode_stripsLoginTask_and_buildsLoginYamlPreview() {
        String yaml = "web:\n  url: https://app.example.com/home\ntasks:\n"
                + "  - name: 登录\n    flow:\n      - aiInput: 'admin'\n"
                + "  - name: 查询订单\n    flow:\n      - aiTap: 订单菜单\n";
        TestCase tc = buildCase("1001", "YAML", "查询订单", yaml, "lm-1");
        when(testCaseService.getById("1001")).thenReturn(tc);
        when(loginMethodService.getById("lm-1")).thenReturn(buildLocalLogin("lm-1"));

        FinalScriptPreview preview = service.previewFinalScript("1001");

        assertThat(preview.getExecutionMode()).isEqualTo("YAML");
        // 最终 yamlScript 已剔除登录 task（SnakeYAML dump 后的文本）
        assertThat(preview.getYamlScript()).contains("查询订单").doesNotContain("name: 登录");
        // 登录方式负载已注入
        assertThat(preview.getLoginMethod()).isNotNull();
        assertThat(preview.getLoginMethod().getUsername()).isEqualTo("admin");
        assertThat(preview.getLoginMethod().getType()).isEqualTo("local");
        // 登录 YAML 模板：账号/密码（单引号转义）+ [动态] 行 → cacheable: false + aiWaitFor 收尾
        assertThat(preview.getLoginYamlPreview())
                .contains("- name: 登录")
                .contains("aiInput: 'admin'")
                .contains("aiInput: 'p''w'")
                .contains("locate: 账号或用户名输入框")
                .contains("locate: 密码输入框")
                .contains("aiAct: '输入验证码 1234'")
                .contains("cacheable: false")
                .contains("aiAct: '关闭升级提示弹窗'")
                .contains("aiAct: '点击登录按钮，完成登录'")
                .contains("aiWaitFor: '登录已完成，页面已进入登录后的主界面'");
        // YAML 模式不提取 targetUrl
        assertThat(preview.getTargetUrl()).isNull();
        assertThat(preview.getTimeout()).isEqualTo(600 * 1000);
        assertThat(preview.getWarnings()).isEmpty();
    }

    @Test
    @DisplayName("预览: NLP 模式 → 剥离登录前缀 + 从 YAML 提取 targetUrl")
    void previewFinalScript_nlpMode_stripsLegacyPrefix_and_extractsTargetUrl() {
        String yaml = "web:\n  url: https://app.example.com/home\ntasks:\n  - name: 登录\n    flow: []\n";
        String nlp = "打开 https://sso.example.com/login，输入登录名 admin，密码 pw，点击登录\n在首页断言用户名 admin";
        TestCase tc = buildCase("1002", "NLP", nlp, yaml, "lm-2");
        when(testCaseService.getById("1002")).thenReturn(tc);
        LoginMethod lm = buildLocalLogin("lm-2");
        lm.setPassword("pw");
        lm.setStepsNlp(null);
        when(loginMethodService.getById("lm-2")).thenReturn(lm);

        FinalScriptPreview preview = service.previewFinalScript("1002");

        assertThat(preview.getExecutionMode()).isEqualTo("NLP");
        // 登录前缀已剥离，仅保留业务步骤
        assertThat(preview.getNlp()).isEqualTo("在首页断言用户名 admin");
        // targetUrl 从 yamlFlow 的 web.url 提取
        assertThat(preview.getTargetUrl()).isEqualTo("https://app.example.com/home");
        assertThat(preview.getLoginYamlPreview()).contains("aiAct: '点击登录按钮，完成登录'");
    }

    @Test
    @DisplayName("预览: YAML 未生成时返回 200 + warnings 告警（执行会被拒绝），不抛错")
    void previewFinalScript_missingYaml_returnsWarning() {
        TestCase tc = buildCase("1003", "YAML", "查询订单", null, null);
        when(testCaseService.getById("1003")).thenReturn(tc);

        FinalScriptPreview preview = service.previewFinalScript("1003");

        assertThat(preview.getExecutionMode()).isEqualTo("YAML");
        assertThat(preview.getYamlScript()).isNull();
        assertThat(preview.getWarnings()).anyMatch(w -> w.contains("yamlFlow 未生成"));
    }

    @Test
    @DisplayName("预览: 免登录（type=none）不注入登录负载、无登录 YAML 预览")
    void previewFinalScript_noneLogin_noLoginPayload() {
        String yaml = "web:\n  url: https://app.example.com\ntasks:\n  - name: 查询\n    flow:\n      - aiTap: 菜单\n";
        TestCase tc = buildCase("1004", "YAML", "查询", yaml, "lm-4");
        when(testCaseService.getById("1004")).thenReturn(tc);
        LoginMethod none = new LoginMethod();
        none.setId("lm-4");
        none.setType("none");
        when(loginMethodService.getById("lm-4")).thenReturn(none);

        FinalScriptPreview preview = service.previewFinalScript("1004");

        assertThat(preview.getLoginMethod()).isNull();
        assertThat(preview.getLoginYamlPreview()).isNull();
        // 免登录时不剔除登录 task（原样下发）
        assertThat(preview.getYamlScript()).contains("查询");
    }

    @Test
    @DisplayName("预览: 登录方式含预生成 yamlScript 时，登录 YAML 预览直接透出其 tasks")
    void previewFinalScript_loginYamlScript_passthrough() {
        String loginYaml = "tasks:\n  - name: 登录\n    flow:\n      - aiInput: 'admin'\n";
        TestCase tc = buildCase("1005", "NLP", "业务步骤", null, "lm-5");
        when(testCaseService.getById("1005")).thenReturn(tc);
        LoginMethod lm = buildLocalLogin("lm-5");
        lm.setYamlScript(loginYaml);
        when(loginMethodService.getById("lm-5")).thenReturn(lm);

        FinalScriptPreview preview = service.previewFinalScript("1005");

        // SnakeYAML dump 的 tasks 透出（引号风格与 JS yaml.dump 不同，语义一致）
        assertThat(preview.getLoginYamlPreview()).contains("aiInput: admin").contains("name: 登录").startsWith("tasks:");
    }

    // ── buildExecuteRequest（执行与预览共用组装路径） ──

    @Test
    @DisplayName("buildExecuteRequest: warnings 为 null（执行路径）缺失内容不记录告警")
    void buildExecuteRequest_nullWarnings_noCollection() {
        TestCase tc = buildCase("1006", "YAML", "查询订单", null, null);
        ExecuteRequest request = service.buildExecuteRequest(tc, null, null, null);
        assertThat(request.getExecutionMode()).isEqualTo("YAML");
        assertThat(request.getYamlScript()).isNull();
        assertThat(request.getHeadless()).isTrue();
        assertThat(request.getTimeout()).isEqualTo(600 * 1000);
        assertThat(request.getCacheContent()).isNull();
        assertThat(request.getName()).isEqualTo("用例-1006");
    }

    @Test
    @DisplayName("buildExecuteRequest: 自定义 YAML 优先于 yamlFlow")
    void buildExecuteRequest_customYamlWins() {
        TestCase tc = buildCase("1007", "YAML", null, "tasks:\n  - name: 存量\n", null);
        ExecuteRequest request = service.buildExecuteRequest(tc, "tasks:\n  - name: 自定义\n", null, null);
        assertThat(request.getYamlScript()).contains("自定义").doesNotContain("存量");
    }
}
