package com.smarttesting.platform.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CaseExecutionService 纯逻辑单测（示例：red-green 节奏）
 * 覆盖点：stripLoginTask（剔除登录 task）与 extractWebUrl（提取目标网址）
 * 说明：两方法为 private，通过反射调用；Mapper/外部依赖均不需要（纯逻辑）
 */
@ExtendWith(MockitoExtension.class)
class CaseExecutionServiceTest {

    @InjectMocks
    private CaseExecutionService service;

    /** 反射调用 private 方法 */
    private String invokeStringMethod(String name, String arg) throws Exception {
        Method m = CaseExecutionService.class.getDeclaredMethod(name, String.class);
        m.setAccessible(true);
        return (String) m.invoke(service, arg);
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
}
