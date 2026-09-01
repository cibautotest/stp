package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.mapper.ProjectMapper;
import com.smarttesting.platform.mapper.TestCaseMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.List;

/**
 * 项目服务
 */
@Service
public class ProjectService extends ServiceImpl<ProjectMapper, Project> {

    @Resource
    private TestCaseMapper testCaseMapper;

    @Resource
    private UserService userService;

    /**
     * 创建项目，并自动将创建者加入项目权限
     *
     * @param project 项目信息
     * @param userId  创建者用户ID（可能为 null，如未登录）
     */
    @Transactional(rollbackFor = Exception.class)
    public void createProject(Project project, Long userId) {
        // 记录创建者
        project.setCreatedBy(userId);
        // 保存项目
        save(project);

        // 自动为创建者分配项目权限
        if (userId != null) {
            userService.assignProjectToUser(userId, project.getId());
        }
    }

    /**
     * 分页查询项目列表，支持按名称模糊搜索 + 按用户权限过滤
     *
     * @param name         项目名称关键字（可为 null，表示查询全部）
     * @param page         页码
     * @param size         每页大小
     * @param currentUserId 当前用户 ID（可为 null，不限制）
     * @param role         当前用户角色（sysadmin 不过滤）
     * @return 分页结果
     */
    public IPage<Project> listByName(String name, int page, int size,
                                      Long currentUserId, String role) {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getDeleted, 0);

        // 非 sysadmin 需要按用户项目权限过滤
        if (currentUserId != null && !"sysadmin".equals(role)) {
            List<String> projectIds = userService.getUserProjectIds(currentUserId);
            if (projectIds.isEmpty()) {
                // 无权限项目时返回空
                return Page.of(page, size);
            }
            wrapper.in(Project::getId, projectIds);
        }

        if (name != null && !name.isBlank()) {
            wrapper.like(Project::getName, name);
        }
        wrapper.orderByDesc(Project::getUpdatedAt);
        return page(Page.of(page, size), wrapper);
    }

    /**
     * 获取当前用户可访问的项目 ID 列表
     */
    public List<String> getAccessibleProjectIds(Long userId, String role) {
        if ("sysadmin".equals(role)) {
            return lambdaQuery().eq(Project::getDeleted, 0)
                    .list().stream().map(Project::getId).collect(java.util.stream.Collectors.toList());
        }
        return userService.getUserProjectIds(userId);
    }

    /**
     * 检查项目名是否已存在
     */
    public boolean isNameExists(String name) {
        return lambdaQuery().eq(Project::getName, name).exists();
    }

    /**
     * 根据项目名查找项目
     */
    public Project findByName(String name) {
        return lambdaQuery().eq(Project::getName, name).eq(Project::getDeleted, 0).one();
    }

    /**
     * 检查项目名是否已存在（排除指定ID）
     */
    public boolean isNameExists(String name, String excludeId) {
        return lambdaQuery()
                .eq(Project::getName, name)
                .ne(Project::getId, excludeId)
                .exists();
    }

    /**
     * 删除项目及其关联用例
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean deleteWithCases(String id) {
        // 删除关联用例
        testCaseMapper.delete(new LambdaQueryWrapper<com.smarttesting.platform.entity.TestCase>()
                .eq(com.smarttesting.platform.entity.TestCase::getProjectId, id));
        // 删除项目
        return removeById(id);
    }
}
