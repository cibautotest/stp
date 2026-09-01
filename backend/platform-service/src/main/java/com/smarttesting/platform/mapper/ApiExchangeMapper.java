package com.smarttesting.platform.mapper;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.ApiExchange;
import org.apache.ibatis.annotations.*;
import java.util.List;
@Mapper public interface ApiExchangeMapper extends BaseMapper<ApiExchange> {
 @Select("SELECT * FROM api_exchange WHERE execution_id=#{executionId} ORDER BY started_at ASC")
 List<ApiExchange> selectByExecutionId(@Param("executionId") String executionId);
 @Select("SELECT * FROM api_exchange WHERE report_id=#{reportId} ORDER BY started_at ASC")
 List<ApiExchange> selectByReportId(@Param("reportId") Long reportId);
 @Select("SELECT * FROM api_exchange WHERE case_id=#{caseId} ORDER BY started_at ASC")
 List<ApiExchange> selectByCaseId(@Param("caseId") String caseId);
 @Select("SELECT * FROM api_exchange WHERE execution_id=#{executionId} AND request_id=#{requestId} LIMIT 1")
 ApiExchange selectByExecutionIdAndRequestId(@Param("executionId") String executionId, @Param("requestId") String requestId);
 @Update("UPDATE api_exchange SET report_id=#{reportId} WHERE execution_id=#{executionId}")
 int updateReportIdByExecutionId(@Param("executionId") String executionId, @Param("reportId") Long reportId);
}
