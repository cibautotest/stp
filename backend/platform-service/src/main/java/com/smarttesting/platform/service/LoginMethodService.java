package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.LoginMethod;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.LoginMethodMapper;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class LoginMethodService extends ServiceImpl<LoginMethodMapper, LoginMethod> {
    @Resource private TestCaseService testCaseService;

    public List<LoginMethod> listByProject(String projectId) {
        return lambdaQuery().eq(LoginMethod::getProjectId, projectId)
                .orderByAsc(LoginMethod::getCreatedAt).list();
    }

    public void createMethod(LoginMethod method) {
        if (!"none".equals(method.getType()) && !"cas".equals(method.getType()) && !"local".equals(method.getType())) {
            throw new IllegalArgumentException("type 必须是 none / cas / local 之一");
        }
        if (method.getCacheStatus() == null || method.getCacheStatus().isBlank()) {
            method.setCacheStatus("uncached");
        }
        method.setCreatedAt(LocalDateTime.now());
        method.setUpdatedAt(LocalDateTime.now());
        save(method);
    }

    public void updateMethod(LoginMethod method) {
        method.setUpdatedAt(LocalDateTime.now());
        updateById(method);
    }

    public void updateCacheStatus(String id, String status) {
        if (!"uncached".equals(status) && !"cached".equals(status)) {
            throw new IllegalArgumentException("status 必须是 uncached / cached");
        }
        LoginMethod m = new LoginMethod();
        m.setId(id);
        m.setCacheStatus(status);
        m.setUpdatedAt(LocalDateTime.now());
        updateById(m);
    }

    public void deleteMethod(String id) {
        LoginMethod method = getById(id);
        if (method == null) throw new IllegalArgumentException("登录方式不存在");
        long caseCount = testCaseService.lambdaQuery().eq(TestCase::getLoginMethodId, id).count();
        if (caseCount > 0) throw new IllegalArgumentException("该登录方式已被测试用例引用，无法删除");
        removeById(id);
    }
}
