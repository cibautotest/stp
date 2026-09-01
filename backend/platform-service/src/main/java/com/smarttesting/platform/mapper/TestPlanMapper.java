package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.TestPlan;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface TestPlanMapper extends BaseMapper<TestPlan> {
}
