package com.smarttesting.platform.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.smarttesting.platform.entity.ExecutionRecord;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 执行记录 Mapper
 */
@Mapper
public interface ExecutionRecordMapper extends BaseMapper<ExecutionRecord> {

    /**
     * 查询所有 RUNNING 状态的执行记录
     */
    @Select("SELECT * FROM execution_record WHERE status = 'RUNNING'")
    List<ExecutionRecord> selectRunningRecords();

    /**
     * 根据 executionId 查询记录
     */
    @Select("SELECT * FROM execution_record WHERE execution_id = #{executionId} LIMIT 1")
    ExecutionRecord selectByExecutionId(@Param("executionId") String executionId);

    /**
     * 根据 caseId 查询最新执行记录
     */
    @Select("SELECT * FROM execution_record WHERE case_id = #{caseId} ORDER BY created_at DESC LIMIT 1")
    ExecutionRecord selectLatestByCaseId(@Param("caseId") String caseId);

    /**
     * 根据 batchId 查询所有执行记录
     */
    @Select("SELECT * FROM execution_record WHERE batch_id = #{batchId} ORDER BY created_at ASC")
    List<ExecutionRecord> selectByBatchId(@Param("batchId") String batchId);

    /**
     * 根据 batchId 查询仍在 RUNNING 状态的记录数
     */
    @Select("SELECT COUNT(*) FROM execution_record WHERE batch_id = #{batchId} AND status = 'RUNNING'")
    int countRunningByBatchId(@Param("batchId") String batchId);
}
