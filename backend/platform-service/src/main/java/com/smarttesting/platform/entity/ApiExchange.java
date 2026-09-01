package com.smarttesting.platform.entity;
import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("api_exchange")
public class ApiExchange {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long reportId;
    private String requestId;
    private String executionId;
    private String caseId;
    private String traceId;
    private String segmentId;
    private String method;
    private String url;
    private String resourceType;
    private Integer statusCode;
    private Long durationMs;
    private String contentType;
    private String requestHeaders;
    private String requestBodyBase64;
    private Boolean requestBodyTruncated;
    private String responseHeaders;
    private String responseBodyBase64;
    private Boolean responseBodyTruncated;
    private String errorMessage;
    private LocalDateTime startedAt;
    private LocalDateTime completedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
