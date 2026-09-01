package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.smarttesting.platform.entity.Report;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 测试报告 Mapper
 */
@Mapper
public interface ReportMapper extends BaseMapper<Report> {

    /**
     * 分页查询报告（LEFT JOIN projects 获取项目名称）
     */
    IPage<Report> pageReportsWithJoin(Page<Report> page, @Param("projectId") String projectId);
}
