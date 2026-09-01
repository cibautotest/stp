package com.smarttesting.platform.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 分页结果包装类
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "分页查询结果")
public class PageResult<T> {

    @Schema(description = "总记录数", example = "100")
    private long total;

    @Schema(description = "当前页码", example = "1")
    private long page;

    @Schema(description = "每页大小", example = "10")
    private long size;

    @Schema(description = "数据列表")
    private List<T> items;

    public static <T> PageResult<T> of(long total, long page, long size, List<T> items) {
        return new PageResult<>(total, page, size, items);
    }
}
