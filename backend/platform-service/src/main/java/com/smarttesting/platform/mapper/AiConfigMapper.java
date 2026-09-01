package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.AiConfig;
import org.apache.ibatis.annotations.Mapper;

/**
 * AI 配置 Mapper
 */
@Mapper
public interface AiConfigMapper extends BaseMapper<AiConfig> {
}
