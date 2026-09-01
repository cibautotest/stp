package com.smarttesting.platform.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.smarttesting.platform.entity.AiConfig;
import com.smarttesting.platform.mapper.AiConfigMapper;
import org.springframework.stereotype.Service;

/**
 * AI 配置服务
 */
@Service
public class AiConfigService extends ServiceImpl<AiConfigMapper, AiConfig> {

    /**
     * 获取当前配置（表中只有一条记录）
     */
    public AiConfig getCurrentConfig() {
        return lambdaQuery().last("LIMIT 1").one();
    }
}
