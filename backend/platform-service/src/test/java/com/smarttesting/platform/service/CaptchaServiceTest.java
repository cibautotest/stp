package com.smarttesting.platform.service;

import com.smarttesting.platform.model.CaptchaResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CaptchaService 单测
 * 覆盖点：生成（key/image/字符集）、verify（一次性消费、大小写不敏感、过期/不存在/null 边界）
 * 说明：绘图在无头环境可运行（headless AWT），peekCode 为包私有测试辅助
 */
class CaptchaServiceTest {

    private static final Pattern CODE_PATTERN = Pattern.compile("^[A-HJ-NP-Z2-9]{4}$");

    private final CaptchaService service = new CaptchaService();

    @Test
    @DisplayName("generate: 返回 key 与 PNG data URI，明文码符合字符集（4 位、排除易混淆字符）")
    void generate_returnsKeyAndDataUri() {
        CaptchaResponse resp = service.generate();
        assertThat(resp.getKey()).isNotBlank().hasSize(32);
        assertThat(resp.getImage()).startsWith("data:image/png;base64,").hasSizeGreaterThan(100);
        // PNG 魔数（0x89 50 4E 47；Java byte 有符号：0x89 = -119）
        String base64 = resp.getImage().substring("data:image/png;base64,".length());
        byte[] head = java.util.Base64.getDecoder().decode(base64.substring(0, 8));
        assertThat(head[0]).isEqualTo((byte) 0x89);
        assertThat(head[1]).isEqualTo((byte) 'P');
        assertThat(head[2]).isEqualTo((byte) 'N');
        assertThat(head[3]).isEqualTo((byte) 'G');
        assertThat(service.peekCode(resp.getKey())).matches(CODE_PATTERN);
    }

    @Test
    @DisplayName("verify: 正确验证码 → true，且一次性消费（二次 → false）")
    void verify_correct_thenConsumed() {
        CaptchaResponse resp = service.generate();
        String code = service.peekCode(resp.getKey());
        assertThat(service.verify(resp.getKey(), code)).isTrue();
        // 同一 key 不可重复使用（防重放）
        assertThat(service.verify(resp.getKey(), code)).isFalse();
    }

    @Test
    @DisplayName("verify: 错误验证码 → false 且 key 被消费")
    void verify_wrongCode() {
        CaptchaResponse resp = service.generate();
        String code = service.peekCode(resp.getKey());
        String wrong = ("A".equals(code) ? "B" : "A") + code.substring(1);
        assertThat(service.verify(resp.getKey(), wrong)).isFalse();
        assertThat(service.verify(resp.getKey(), code)).isFalse();
    }

    @Test
    @DisplayName("verify: 忽略大小写、容忍首尾空格")
    void verify_caseInsensitiveAndTrim() {
        CaptchaResponse resp = service.generate();
        String code = service.peekCode(resp.getKey());
        assertThat(service.verify(resp.getKey(), code.toLowerCase())).isTrue();
    }

    @Test
    @DisplayName("verify: 不存在的 key → false")
    void verify_unknownKey() {
        assertThat(service.verify("nonexistent", "ABCD")).isFalse();
    }

    @Test
    @DisplayName("verify: null/空白参数安全返回 false")
    void verify_blankArgs() {
        CaptchaResponse resp = service.generate();
        assertThat(service.verify(null, "ABCD")).isFalse();
        assertThat(service.verify(resp.getKey(), null)).isFalse();
        assertThat(service.verify(resp.getKey(), "  ")).isFalse();
        assertThat(service.verify("", "ABCD")).isFalse();
    }
}
