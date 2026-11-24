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
        LoginMethod existing = getById(method.getId());
        if (existing == null) {
            throw new IllegalArgumentException("登录方式不存在");
        }
        // 登录核心信息变更 → 旧缓存（login_{id}）必然失效，重置为 uncached（执行时重新登录生成缓存）
        if (hasLoginContentChanged(existing, method)) {
            method.setCacheStatus("uncached");
        }
        method.setUpdatedAt(LocalDateTime.now());
        updateById(method);
    }

    /**
     * 判断登录核心字段是否有变化（提交值为 null 表示不修改，对齐 MyBatis-Plus updateById 非 null 更新语义）。
     * 纯函数，可单测。
     */
    static boolean hasLoginContentChanged(LoginMethod oldM, LoginMethod newM) {
        return fieldChanged(oldM.getType(), newM.getType())
                || fieldChanged(oldM.getLoginUrl(), newM.getLoginUrl())
                || fieldChanged(oldM.getUsername(), newM.getUsername())
                || fieldChanged(oldM.getPassword(), newM.getPassword())
                || fieldChanged(oldM.getStepsNlp(), newM.getStepsNlp())
                || fieldChanged(oldM.getYamlScript(), newM.getYamlScript());
    }

    private static boolean fieldChanged(String oldVal, String newVal) {
        if (newVal == null) return false;
        return !newVal.equals(oldVal);
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
