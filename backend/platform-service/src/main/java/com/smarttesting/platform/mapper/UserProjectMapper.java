package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.UserProject;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户-项目关联 Mapper
 */
@Mapper
public interface UserProjectMapper extends BaseMapper<UserProject> {
}
