package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.LoginMethod;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * LoginMethodService 纯逻辑单测
 * 覆盖点：hasLoginContentChanged（登录核心字段变化检测 → cacheStatus 重置依据）
 */
class LoginMethodServiceTest {

    private LoginMethod base() {
        LoginMethod m = new LoginMethod();
        m.setId("lm-1");
        m.setType("cas");
        m.setLoginUrl("https://sso.example.com/login");
        m.setUsername("admin");
        m.setPassword("pw");
        m.setStepsNlp("[动态] 输入验证码");
        m.setYamlScript(null);
        return m;
    }

    @Test
    @DisplayName("账号变更 → 视为变化（缓存需重置）")
    void changed_username() {
        LoginMethod n = base();
        n.setUsername("admin2");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();
    }

    @Test
    @DisplayName("密码/登录网址/类型/stepsNlp/yamlScript 任一变更 → 视为变化")
    void changed_anyCoreField() {
        LoginMethod n = base(); n.setPassword("newpw");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();

        n = base(); n.setLoginUrl("https://other.example.com");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();

        n = base(); n.setType("local");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();

        n = base(); n.setStepsNlp("[动态] 滑块验证");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();

        n = base(); n.setYamlScript("tasks:\n  - name: 登录\n");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();
    }

    @Test
    @DisplayName("提交值与库中一致 → 无变化")
    void unchanged_sameValues() {
        LoginMethod n = base();
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isFalse();
    }

    @Test
    @DisplayName("null 字段表示不修改 → 无变化（部分更新语义）")
    void unchanged_nullMeansKeep() {
        LoginMethod n = new LoginMethod();
        n.setId("lm-1");
        n.setUsername("admin"); // 只更新账号且值相同
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isFalse();

        n = new LoginMethod();
        n.setId("lm-1");
        n.setPassword(null); // 显式 null = 不改密码
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isFalse();
    }

    @Test
    @DisplayName("字段从 null 更新为非 null → 视为变化")
    void changed_fromNull() {
        LoginMethod n = base();
        n.setYamlScript("tasks: []");
        assertThat(LoginMethodService.hasLoginContentChanged(base(), n)).isTrue();
    }
}
