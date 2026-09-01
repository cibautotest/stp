package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.User;
import com.smarttesting.platform.entity.UserProject;
import com.smarttesting.platform.mapper.UserMapper;
import com.smarttesting.platform.mapper.UserProjectMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.Resource;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 用户服务 — 用户 CRUD + 项目权限管理
 */
@Service
public class UserService extends ServiceImpl<UserMapper, User> {

    @Resource
    private UserProjectMapper userProjectMapper;

    @Resource
    private PasswordEncoder passwordEncoder;

    /**
     * 根据用户名查询用户
     */
    public User getByUsername(String username) {
        return lambdaQuery()
                .eq(User::getUsername, username)
                .eq(User::getDeleted, 0)
                .one();
    }

    /**
     * 创建用户（密码自动 BCrypt 加密）
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean createUser(User user, String rawPassword) {
        user.setPassword(passwordEncoder.encode(rawPassword));
        if (user.getRole() == null) {
            user.setRole("general");
        }
        if (user.getStatus() == null) {
            user.setStatus(1);
        }
        return save(user);
    }

    /**
     * 更新用户密码
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean updatePassword(Long userId, String newPassword) {
        User user = getById(userId);
        if (user == null) {
            return false;
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        return updateById(user);
    }

    /**
     * 修改当前用户密码
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean changePassword(Long userId, String oldPassword, String newPassword) {
        User user = getById(userId);
        if (user == null || user.getPassword() == null) {
            return false;
        }
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new IllegalArgumentException("原密码不正确");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        return updateById(user);
    }

    /**
     * 获取用户可访问的项目 ID 列表
     */
    public List<String> getUserProjectIds(Long userId) {
        return userProjectMapper.selectList(
                new LambdaQueryWrapper<UserProject>()
                        .eq(UserProject::getUserId, userId)
        ).stream().map(UserProject::getProjectId).collect(Collectors.toList());
    }

    /**
     * 为用户分配项目权限
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignProjects(Long userId, List<String> projectIds) {
        // 先清除原有权限
        userProjectMapper.delete(
                new LambdaQueryWrapper<UserProject>()
                        .eq(UserProject::getUserId, userId)
        );
        // 再新增权限
        for (String projectId : projectIds) {
            UserProject up = new UserProject();
            up.setUserId(userId);
            up.setProjectId(projectId);
            userProjectMapper.insert(up);
        }
    }

    /**
     * 获取用户的已分配项目 ID 列表
     */
    public List<String> getAssignedProjectIds(Long userId) {
        return getUserProjectIds(userId);
    }

    /**
     * 为单个用户分配单个项目权限（用于创建项目时自动分配）
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignProjectToUser(Long userId, String projectId) {
        // 检查是否已存在，避免重复插入
        Long count = userProjectMapper.selectCount(
                new LambdaQueryWrapper<UserProject>()
                        .eq(UserProject::getUserId, userId)
                        .eq(UserProject::getProjectId, projectId)
        );
        if (count == null || count == 0) {
            UserProject up = new UserProject();
            up.setUserId(userId);
            up.setProjectId(projectId);
            userProjectMapper.insert(up);
        }
    }
}
