package com.smarttesting.platform.entity;

import com.baomidou.mybatisplus.annotation.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 测试报告实体
 */
@Data
@Schema(description = "测试报告")
@TableName("reports")
public class Report {

    @TableId(type = IdType.AUTO)
    @Schema(description = "报告ID")
    private Long id;

    @Schema(description = "关联用例ID")
    private String caseId;

    @Schema(description = "批次ID（批量执行关联）")
    private String batchId;

    @Schema(description = "报告类型: SINGLE/BATCH")
    private String type;

    @Schema(description = "报告名称")
    private String name;

    @Schema(description = "所属项目ID")
    private String projectId;

    @Schema(description = "所属用例目录ID")
    private String directoryId;

    @TableField(exist = false)
    @Schema(description = "所属项目名称")
    private String projectName;

    @Schema(description = "执行状态", example = "PASSED")
    private String status;

    @Schema(description = "执行耗时（毫秒）")
    private Long duration;

    @Schema(description = "NLP 指令")
    private String nlp;

    @Schema(description = "目标 URL")
    private String url;

    @Schema(description = "YAML 流程")
    private String yamlFlow;

    @Schema(description = "执行结果")
    private String result;

    @Schema(description = "错误信息")
    private String error;

    @Schema(description = "执行日志")
    private String logs;

    @Schema(description = "合并报告文件路径（BATCH类型）")
    private String mergedReportPath;

    @TableField(fill = FieldFill.INSERT)
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}
