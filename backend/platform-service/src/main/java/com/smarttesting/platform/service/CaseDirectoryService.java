package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.CaseDirectory;
import com.smarttesting.platform.entity.TestCase;
import com.smarttesting.platform.mapper.CaseDirectoryMapper;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

@Service
public class CaseDirectoryService extends ServiceImpl<CaseDirectoryMapper, CaseDirectory> {
    @Resource private TestCaseService testCaseService;

    public List<CaseDirectory> listByProject(String projectId) {
        return lambdaQuery().eq(CaseDirectory::getProjectId, projectId)
                .orderByAsc(CaseDirectory::getCreatedAt).list();
    }

    public void deleteDirectory(String id) {
        CaseDirectory directory = getById(id);
        if (directory == null) throw new IllegalArgumentException("目录不存在");
        long childCount = lambdaQuery().eq(CaseDirectory::getParentId, id).count();
        if (childCount > 0) throw new IllegalArgumentException("该目录含有子目录，无法删除");
        long caseCount = testCaseService.lambdaQuery().eq(TestCase::getDirectoryId, id).count();
        if (caseCount > 0) throw new IllegalArgumentException("该目录下存在测试用例，无法删除");
        removeById(id);
    }
}
