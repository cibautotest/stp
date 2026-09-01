package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.entity.User;
import com.smarttesting.platform.mapper.ProjectMapper;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;

/** Resolves execution engine configuration: user first, then project. */
@Service
public class ExecuteServiceUrlResolver {
    @Resource private UserService userService;
    @Resource private ProjectMapper projectMapper;

    public String resolve(Long userId, String projectId) {
        if (userId != null) {
            User user = userService.getById(userId);
            if (user != null && hasText(user.getExecuteServiceUrl())) return normalize(user.getExecuteServiceUrl());
        }
        Project project = projectMapper.selectById(projectId);
        if (project != null && hasText(project.getExecuteServiceUrl())) return normalize(project.getExecuteServiceUrl());
        throw new IllegalArgumentException("未配置执行机");
    }

    private boolean hasText(String value) { return value != null && !value.isBlank(); }
    private String normalize(String value) { return value.trim().replaceAll("/+$", ""); }
}
