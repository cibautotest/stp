package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.ReportMapper;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import org.springframework.beans.factory.annotation.Value;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 报告服务
 */
@Service
public class ReportService extends ServiceImpl<ReportMapper, Report> {

    @Value("${reports.storage-directory:./data/reports}")
    private String storageDirectory;

    @Resource
    private TestCaseService testCaseService;

    @Resource
    private ProjectService projectService;

    public boolean canAccessReport(Report report, Long userId, String role) {
        if (report == null) return false;
        if ("sysadmin".equals(role)) return true;
        if (userId == null || report.getProjectId() == null) return false;
        return projectService.getAccessibleProjectIds(userId, role).contains(report.getProjectId());
    }

    /**
     * 根据用例ID获取报告
     */
    public Report getByCaseId(String caseId) {
        return lambdaQuery()
                .eq(Report::getCaseId, caseId)
                .orderByDesc(Report::getCreatedAt)
                .last("LIMIT 1")
                .one();
    }

    /**
     * 分页查询报告
     */
    public IPage<Report> pageReports(int pageNum, int pageSize, Long userId, String role, String projectId, String directoryId) {
        LambdaQueryWrapper<Report> wrapper = new LambdaQueryWrapper<>();

        // 非 sysadmin 只返回有权限项目的报告
        if (userId != null && !"sysadmin".equals(role)) {
            List<String> projectIds = projectService.getAccessibleProjectIds(userId, role);
            if (projectIds.isEmpty()) {
                return new Page<>(pageNum, pageSize);
            }
            // 获取这些项目下的所有用例 ID
            List<TestCase> accessibleCases = testCaseService.lambdaQuery()
                    .in(TestCase::getProjectId, projectIds)
                    .list();
            if (accessibleCases.isEmpty()) {
                return new Page<>(pageNum, pageSize);
            }
            List<String> caseIds = accessibleCases.stream()
                    .map(TestCase::getId)
                    .collect(Collectors.toList());
            wrapper.in(Report::getCaseId, caseIds);
        }

        if (projectId != null && !projectId.isBlank()) wrapper.eq(Report::getProjectId, projectId);
        if (directoryId != null && !directoryId.isBlank()) wrapper.eq(Report::getDirectoryId, directoryId);
        wrapper.orderByDesc(Report::getCreatedAt);
        return page(new Page<>(pageNum, pageSize), wrapper);
    }

    /**
     * 删除报告
     */
    public boolean deleteReport(Long id) {
        Report report = getById(id);
        if (report == null) return false;
        boolean deleted = removeById(id);
        if (deleted && report.getResult() != null) {
            String prefix = "/api/platform/reports/content/";
            if (report.getResult().startsWith(prefix)) {
                String executionId = report.getResult().substring(prefix.length());
                if (executionId.matches("[A-Za-z0-9_-]{1,128}")) {
                    try {
                        Files.deleteIfExists(Path.of(storageDirectory).toAbsolutePath().normalize()
                                .resolve(executionId + ".html"));
                    } catch (Exception ignored) {
                        // Database deletion is authoritative; an orphan can be safely cleaned later.
                    }
                }
            }
        }
        return deleted;
    }
}
