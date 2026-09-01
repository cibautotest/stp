package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.entity.TestPlan;
import com.smarttesting.platform.entity.TestPlanCase;
import com.smarttesting.platform.mapper.TestPlanCaseMapper;
import com.smarttesting.platform.mapper.TestPlanMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 测试计划服务
 */
@Service
public class TestPlanService extends ServiceImpl<TestPlanMapper, TestPlan> {

    @Resource
    private TestPlanCaseMapper testPlanCaseMapper;

    @Resource
    private ProjectService projectService;

    @Resource
    private TestCaseService testCaseService;

    /**
     * 创建测试计划并批量关联用例
     */
    @Transactional(rollbackFor = Exception.class)
    public TestPlan createPlan(TestPlan plan, List<String> caseIds, Long userId) {
        plan.setStatus("ACTIVE");
        plan.setCreatedBy(userId);
        save(plan);

        if (caseIds != null && !caseIds.isEmpty()) {
            int order = 0;
            for (String caseId : caseIds) {
                TestPlanCase tpc = new TestPlanCase();
                tpc.setPlanId(plan.getId());
                tpc.setCaseId(caseId);
                tpc.setSortOrder(order++);
                testPlanCaseMapper.insert(tpc);
            }
        }
        return plan;
    }

    /**
     * 按项目ID查询测试计划列表（含权限过滤）
     */
    public List<TestPlan> listByProject(String projectId, Long userId, String role) {
        // 非 sysadmin 需要校验项目权限
        if (userId != null && !"sysadmin".equals(role)) {
            List<String> accessibleIds = projectService.getAccessibleProjectIds(userId, role);
            if (!accessibleIds.contains(projectId)) {
                throw new org.springframework.security.access.AccessDeniedException("无权访问该项目");
            }
        }
        return lambdaQuery()
                .eq(TestPlan::getProjectId, projectId)
                .eq(TestPlan::getDeleted, 0)
                .orderByDesc(TestPlan::getUpdatedAt)
                .list();
    }

    /**
     * 获取用户有权限的所有项目的测试计划
     */
    public List<TestPlan> listWithAuth(Long userId, String role) {
        LambdaQueryWrapper<TestPlan> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TestPlan::getDeleted, 0);
        if (userId != null && !"sysadmin".equals(role)) {
            List<String> projectIds = projectService.getAccessibleProjectIds(userId, role);
            if (projectIds.isEmpty()) {
                return List.of();
            }
            wrapper.in(TestPlan::getProjectId, projectIds);
        }
        wrapper.orderByDesc(TestPlan::getUpdatedAt);
        return list(wrapper);
    }

    /**
     * 获取计划内的用例列表
     */
    public List<TestCase> getPlanCases(String planId) {
        List<String> caseIds = testPlanCaseMapper.selectList(
                new LambdaQueryWrapper<TestPlanCase>()
                        .eq(TestPlanCase::getPlanId, planId)
                        .orderByAsc(TestPlanCase::getSortOrder)
        ).stream().map(TestPlanCase::getCaseId).collect(Collectors.toList());

        if (caseIds.isEmpty()) {
            return List.of();
        }
        return testCaseService.listByIds(caseIds);
    }

    /**
     * 向计划批量添加用例（自动忽略已存在的关联）
     */
    @Transactional(rollbackFor = Exception.class)
    public int addCasesToPlan(String planId, List<String> caseIds) {
        int added = 0;
        // 获取已存在的关联，避免重复
        List<String> existingCaseIds = testPlanCaseMapper.selectList(
                new LambdaQueryWrapper<TestPlanCase>()
                        .eq(TestPlanCase::getPlanId, planId)
        ).stream().map(TestPlanCase::getCaseId).collect(Collectors.toList());

        int maxOrder = testPlanCaseMapper.selectList(
                new LambdaQueryWrapper<TestPlanCase>()
                        .eq(TestPlanCase::getPlanId, planId)
                        .orderByDesc(TestPlanCase::getSortOrder)
                        .last("LIMIT 1")
        ).stream().findFirst().map(TestPlanCase::getSortOrder).orElse(-1);

        int order = maxOrder + 1;
        for (String caseId : caseIds) {
            if (!existingCaseIds.contains(caseId)) {
                TestPlanCase tpc = new TestPlanCase();
                tpc.setPlanId(planId);
                tpc.setCaseId(caseId);
                tpc.setSortOrder(order++);
                testPlanCaseMapper.insert(tpc);
                added++;
            }
        }
        return added;
    }

    /**
     * 从计划移除用例
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean removeCaseFromPlan(String planId, String caseId) {
        return testPlanCaseMapper.delete(
                new LambdaQueryWrapper<TestPlanCase>()
                        .eq(TestPlanCase::getPlanId, planId)
                        .eq(TestPlanCase::getCaseId, caseId)
        ) > 0;
    }

    /**
     * 获取计划中用例数量
     */
    public int getPlanCaseCount(String planId) {
        return testPlanCaseMapper.selectCount(
                new LambdaQueryWrapper<TestPlanCase>()
                        .eq(TestPlanCase::getPlanId, planId)
        ).intValue();
    }
}
