package com.smarttesting.platform.util;

import com.smarttesting.platform.entity.TestCase;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 用例语义内容摘要（nlp + yamlFlow 的 SHA-256）
 *
 * 用途：录制脚本 STALE 竞态保护——执行下发时把当时的用例内容哈希记入
 * execution_record.dispatched_content_hash；录制脚本上传时与当前用例内容比对：
 *   一致   → STALE 发生在下发之前（用户改完 NLP 后重新执行，属正常重录）→ 放行覆盖；
 *   不一致 → 执行期间 nlp/yamlFlow 又被修改（旧语义的录制结果）→ 拒绝覆盖。
 */
public final class CaseContentDigest {

    private static final String SEPARATOR = "\n---STP-CASE-CONTENT---\n";

    private CaseContentDigest() {
    }

    public static String digest(TestCase testCase) {
        String nlp = testCase.getNlp() == null ? "" : testCase.getNlp();
        String yamlFlow = testCase.getYamlFlow() == null ? "" : testCase.getYamlFlow();
        return sha256(nlp + SEPARATOR + yamlFlow);
    }

    private static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(64);
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 digest unavailable", e);
        }
    }
}
