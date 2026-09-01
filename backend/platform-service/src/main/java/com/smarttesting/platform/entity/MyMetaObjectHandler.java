package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Component
public class MyMetaObjectHandler implements MetaObjectHandler {

    private static final ZoneId PLATFORM_ZONE = ZoneId.of("Asia/Shanghai");

    private LocalDateTime now() {
        return LocalDateTime.now(PLATFORM_ZONE);
    }

    @Override
    public void insertFill(MetaObject metaObject) {
        LocalDateTime now = now();
        strictInsertFill(metaObject, "createdAt", LocalDateTime.class, now);
        strictInsertFill(metaObject, "updatedAt", LocalDateTime.class, now);
    }

    @Override
    public void updateFill(MetaObject metaObject) {
        strictUpdateFill(metaObject, "updatedAt", LocalDateTime.class, now());
    }
}
