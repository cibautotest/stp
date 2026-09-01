package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.RootCauseAnalysis;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface RootCauseAnalysisMapper extends BaseMapper<RootCauseAnalysis> {

    @Select("SELECT * FROM root_cause_analysis WHERE report_id=#{reportId} ORDER BY id DESC LIMIT 1")
    RootCauseAnalysis selectLatestByReportId(@Param("reportId") Long reportId);
}
