package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.TestCaseMapper;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

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
}
