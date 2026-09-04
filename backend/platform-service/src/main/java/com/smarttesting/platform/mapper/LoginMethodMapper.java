package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.LoginMethod;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface LoginMethodMapper extends BaseMapper<LoginMethod> {
}
