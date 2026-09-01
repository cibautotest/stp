package com.smarttesting.platform.controller;
import com.smarttesting.platform.entity.ApiExchange;
import com.smarttesting.platform.entity.Report;
import com.smarttesting.platform.mapper.ApiExchangeMapper;
import com.smarttesting.platform.mapper.ReportMapper;
import com.smarttesting.platform.mapper.ProjectMapper;
import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.model.TraceLogResponse;
import com.smarttesting.platform.model.TraceTopologyResponse;
import com.smarttesting.platform.service.SkyWalkingTraceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import javax.validation.constraints.Positive;
import javax.validation.constraints.Size;
@RestController @RequestMapping("/api/platform/reports")
@Tag(name = "API Exchanges", description = "Report API exchange and trace APIs")
@Validated
public class ApiExchangeController {
 private final ApiExchangeMapper dao;
 private final ReportMapper reportMapper;
 private final ProjectMapper projectMapper;
 private final SkyWalkingTraceService skyWalkingTraceService;
 public ApiExchangeController(ApiExchangeMapper dao, ReportMapper reportMapper, ProjectMapper projectMapper, SkyWalkingTraceService skyWalkingTraceService){this.dao=dao;this.reportMapper=reportMapper;this.projectMapper=projectMapper;this.skyWalkingTraceService=skyWalkingTraceService;}
 @Operation(summary = "List API exchanges by execution ID or report ID")
 @GetMapping("/{executionId}/api-exchanges")
 public List<ApiExchange> list(@Size(max = 128) @PathVariable String executionId){
  // The report page passes the report ID. Resolve it to the execution instance
  // so previous executions of the same case are not mixed together.
  if (executionId.matches("\\d+")) {
   Report report=reportMapper.selectById(Long.valueOf(executionId));
   if (report == null || report.getResult() == null) return List.of();
   String reportExecutionId=report.getResult().substring(report.getResult().lastIndexOf('/') + 1);
   return dao.selectByExecutionId(reportExecutionId);
  }
  // Backward compatibility for callers that already use the execution ID.
  return dao.selectByExecutionId(executionId);
 }
 @Operation(summary = "List API exchanges by report ID")
 @GetMapping("/id/{reportId}/api-exchanges")
 public List<ApiExchange> listByReport(@Positive @PathVariable Long reportId){return dao.selectByReportId(reportId);}
 @Operation(summary = "List API exchanges by case ID")
 @GetMapping("/cases/{caseId}/api-exchanges") public List<ApiExchange> listByCase(@Size(max = 64) @PathVariable String caseId){return dao.selectByCaseId(caseId);}
 @Operation(summary = "Get trace topology for an API exchange")
 @GetMapping("/api-exchanges/{exchangeId}/trace-topology")
 public TraceTopologyResponse traceTopology(@Positive @PathVariable Long exchangeId){
  ApiExchange exchange=dao.selectById(exchangeId);
  if(exchange==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"api exchange not found");
  String skywalkingUrl = resolveSkywalkingUrl(exchange);
  return skyWalkingTraceService.getTopology(exchange, skywalkingUrl);
 }
 @Operation(summary = "Get trace logs for an API exchange")
 @GetMapping("/api-exchanges/{exchangeId}/trace-logs")
 public TraceLogResponse traceLogs(@Positive @PathVariable Long exchangeId){
  ApiExchange exchange=dao.selectById(exchangeId);
  if(exchange==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"api exchange not found");
  return skyWalkingTraceService.getLogs(exchange, resolveSkywalkingUrl(exchange));
 }
 private String resolveSkywalkingUrl(ApiExchange exchange) {
  if (exchange.getReportId() == null) return null;
  Report report = reportMapper.selectById(exchange.getReportId());
  if (report == null || report.getProjectId() == null) return null;
  Project project = projectMapper.selectById(report.getProjectId());
  return project == null ? null : project.getSkywalkingGraphqlUrl();
 }
}
