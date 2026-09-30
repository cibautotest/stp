package com.smarttesting.platform.service;

import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.TestCaseMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 测试用例服务
 */
@Service
public class TestCaseService extends ServiceImpl<TestCaseMapper, TestCase> {

    @Resource
    private ProjectService projectService;

    /**
     * 按项目ID查询用例（已校验用户对该项目有权限）
     */
    public List<TestCase> listByProjectId(String projectId, Long userId, String role) {
        // 非 sysadmin 需要校验项目权限
        if (userId != null && !"sysadmin".equals(role)) {
            List<String> accessibleIds = projectService.getAccessibleProjectIds(userId, role);
            if (!accessibleIds.contains(projectId)) {
                throw new org.springframework.security.access.AccessDeniedException("无权访问该项目");
            }
        }
        return lambdaQuery()
                .eq(TestCase::getProjectId, projectId)
                .orderByDesc(TestCase::getCreatedAt)
                .list();
    }

    /**
     * 获取所有已授权的用例列表（按用户权限过滤项目）
     */
    public List<TestCase> listWithAuth(Long userId, String role) {
        LambdaQueryWrapper<TestCase> wrapper = new LambdaQueryWrapper<>();
        if (userId != null && !"sysadmin".equals(role)) {
            List<String> projectIds = projectService.getAccessibleProjectIds(userId, role);
            if (projectIds.isEmpty()) {
                return List.of();
            }
            wrapper.in(TestCase::getProjectId, projectIds);
        }
        wrapper.orderByDesc(TestCase::getCreatedAt);
        return list(wrapper);
    }

    /**
     * 批量删除用例
     */
    public int batchDelete(List<String> ids) {
        return baseMapper.deleteBatchIds(ids);
    }

    private static final Logger log = LoggerFactory.getLogger(TestCaseService.class);

    @Resource
    private NlpStandardizationService nlpStandardizationService;

    @Resource
    private ExecuteServiceUrlResolver executeServiceUrlResolver;

    /**
     * 批量标准化项目下用例的 NLP 步骤说明（存量用例治理）。
     * 单条失败不阻塞整体；AI 不可用时由标准化服务自动降级本地关键词标记。
     */
    public Map<String, Object> standardizeBatch(String projectId, Long userId, String role) {
        List<TestCase> cases = listByProjectId(projectId, userId, role);
        int total = 0, changed = 0, failed = 0;
        for (TestCase tc : cases) {
            String nlp = tc.getNlp();
            if (nlp == null || nlp.isBlank()) continue;
            total++;
            try {
                String standardized = nlpStandardizationService.standardize(nlp);
                if (standardized != null && !standardized.isBlank() && !standardized.equals(nlp)) {
                    tc.setNlp(standardized);
                    updateById(tc);
                    changed++;
                }
            } catch (Exception e) {
                failed++;
                log.warn("[TestCase] 批量标准化单条失败: caseId={}, {}", tc.getId(), e.getMessage());
            }
        }
        log.info("[TestCase] 批量标准化完成: projectId={}, total={}, changed={}, failed={}", projectId, total, changed, failed);
        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("changed", changed);
        result.put("failed", failed);
        return result;
    }

    /**
     * 获取用例缓存：DB 优先；DB 为空时回源执行引擎磁盘缓存（真相源）并回填 DB，
     * 保证用例管理看到的是最新缓存。
     */
    public String getCacheWithFallback(String id, Long userId) {
        TestCase testCase = getById(id);
        if (testCase == null) return null;
        if (testCase.getCacheContent() != null && !testCase.getCacheContent().isBlank()) {
            return testCase.getCacheContent();
        }
        try {
            String baseUrl = executeServiceUrlResolver.resolve(userId, testCase.getProjectId());
            HttpResponse resp = HttpRequest.get(baseUrl + "/cache/" + id).timeout(10000).execute();
            if (resp.isOk()) {
                String content = resp.body();
                if (content != null && !content.isBlank()) {
                    testCase.setCacheContent(content);
                    updateById(testCase);
                    log.info("[TestCase] 缓存已从执行引擎回源并回填: caseId={}", id);
                    return content;
                }
            }
        } catch (Exception e) {
            log.warn("[TestCase] 缓存回源执行引擎失败: caseId={}, {}", id, e.getMessage());
        }
        return null;
    }
}
