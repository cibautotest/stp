package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.TestPlanCase;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TestPlanCaseMapper extends BaseMapper<TestPlanCase> {

    /**
     * 按 planId + sort_order 升序查 caseId 列表
     */
    @Select("SELECT case_id FROM test_plan_cases WHERE plan_id = #{planId} ORDER BY sort_order ASC")
    List<String> selectCaseIdsByPlanId(@Param("planId") String planId);
}
