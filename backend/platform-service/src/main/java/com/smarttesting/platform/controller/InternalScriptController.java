package com.smarttesting.platform.controller;

import com.smarttesting.platform.entity.ExecutionRecord;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ExecutionRecordMapper;
import com.smarttesting.platform.service.TestCaseService;
import com.smarttesting.platform.util.CaseContentDigest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;
import javax.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 内部录制脚本上传接口（执行引擎回写）
 * 与 InternalCacheController 同模式：白名单放行 + X-Report-Upload-Token 令牌 + 大小限制。
 * STALE 竞态保护：录制执行期间 NLP 已被修改（script_status=STALE）时拒绝覆盖，
 * 防止旧执行结果覆盖新语义。
 */
@RestController
@RequestMapping("/api/platform/internal/scripts")
@Tag(name = "Internal Scripts", description = "Internal recorded Playwright script upload APIs")
@Validated
public class InternalScriptController {
    private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");
    @Value("${reports.upload-token}") private String uploadToken;
    /** 录制脚本上传上限（默认 1MB，脚本远小于报告） */
    @Value("${scripts.max-upload-size:1048576}") private long maxUploadSize;
    @Resource private TestCaseService testCaseService;
    @Resource private ExecutionRecordMapper executionRecordMapper;

    @Operation(summary = "Upload recorded Playwright script for a test case")
    @PutMapping(value = "/{caseId}", consumes = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<?> upload(@Size(max = 64) @PathVariable String caseId,
            @RequestParam(value = "executionId", required = false) @Size(max = 64) String executionId,
            @RequestHeader(value = "X-Report-Upload-Token", required = false) String token,
            @RequestBody byte[] content) {
        if (!ID.matcher(caseId).matches()) return ResponseEntity.badRequest().body(Map.of("error", "Invalid case ID"));
        if (!uploadToken.equals(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid upload token"));
        if (content.length > maxUploadSize) return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("error", "Invalid script size"));
        TestCase testCase = testCaseService.getById(caseId);
        if (testCase == null) return ResponseEntity.notFound().build();
        // STALE 竞态保护（精确判定）：
        //   执行下发时已记录当时用例内容哈希（execution_record.dispatched_content_hash），
        //   与当前内容比对——一致 = STALE 发生在下发前（用户改完 NLP 后重新执行，正常重录）→ 放行覆盖；
        //   不一致 / 无法判定（无 executionId、无记录或旧记录无哈希）= 执行期间被修改的旧结果 → 拒绝。
        if ("STALE".equalsIgnoreCase(testCase.getScriptStatus())) {
            boolean reject = true;
            if (executionId != null && !executionId.isBlank()) {
                ExecutionRecord record = executionRecordMapper.selectByExecutionId(executionId);
                if (record != null && record.getDispatchedContentHash() != null) {
                    reject = !record.getDispatchedContentHash().equals(CaseContentDigest.digest(testCase));
                }
            }
            if (reject) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                        "error", "Case NLP/YAML was modified during recording execution; script update rejected"));
            }
        }
        testCase.setScript(new String(content, StandardCharsets.UTF_8));
        testCase.setScriptStatus("RECORDED");
        if (executionId != null && !executionId.isBlank()) {
            testCase.setScriptSourceExecutionId(executionId);
        }
        testCase.setScriptRecordedAt(LocalDateTime.now());
        testCaseService.updateById(testCase);
        return ResponseEntity.ok(Map.of("success", true));
    }
}
