package com.smarttesting.platform.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttesting.platform.model.FaultSimulationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class FaultSimulationService {

    private static final Logger log = LoggerFactory.getLogger(FaultSimulationService.class);

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public FaultSimulationService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public String createSimulationId() {
        return "fault-" + UUID.randomUUID();
    }

    public void simulatePrimaryKeyConflict(String simulationId, FaultSimulationRequest request) {
        log.info("[FaultSimulation] start scenario=sql-primary-key-conflict, simulationId={}, projectId={}, note={}",
                simulationId, request.getProjectId(), request.getNote());
        try {
            log.info("[FaultSimulation] preparing temporary table, simulationId={}", simulationId);
            jdbcTemplate.execute("CREATE TEMPORARY TABLE IF NOT EXISTS fault_simulation_pk (id BIGINT PRIMARY KEY, name VARCHAR(64))");
            jdbcTemplate.update("DELETE FROM fault_simulation_pk");
            jdbcTemplate.update("INSERT INTO fault_simulation_pk (id, name) VALUES (?, ?)", 1L, "first-write");

            log.info("[FaultSimulation] inserting duplicate primary key to reproduce database constraint failure, simulationId={}",
                    simulationId);
            jdbcTemplate.update("INSERT INTO fault_simulation_pk (id, name) VALUES (?, ?)", 1L, "duplicate-write");
        } catch (DuplicateKeyException e) {
            log.error("[FaultSimulation] expected sql primary key conflict captured, simulationId={}, projectId={}",
                    simulationId, request.getProjectId(), e);
            throw e;
        } catch (RuntimeException e) {
            log.error("[FaultSimulation] unexpected database simulation failure, simulationId={}, projectId={}",
                    simulationId, request.getProjectId(), e);
            throw e;
        }
    }

    public void simulateNullPointer(String simulationId, FaultSimulationRequest request) {
        log.info("[FaultSimulation] start scenario=null-pointer, simulationId={}, projectId={}, note={}",
                simulationId, request.getProjectId(), request.getNote());
        try {
            String missingValue = null;
            log.info("[FaultSimulation] about to dereference nullable value, simulationId={}", simulationId);
            missingValue.trim();
        } catch (NullPointerException e) {
            log.error("[FaultSimulation] expected null pointer captured, simulationId={}, projectId={}",
                    simulationId, request.getProjectId(), e);
            throw e;
        }
    }

    public void simulateMessageParseFailure(String simulationId, FaultSimulationRequest request) {
        log.info("[FaultSimulation] start scenario=message-parse-failure, simulationId={}, projectId={}, note={}",
                simulationId, request.getProjectId(), request.getNote());
        String malformedMessage = "{\"caseId\":\"demo-case\",\"steps\":[{\"action\":\"click\",\"target\":";
        try {
            log.info("[FaultSimulation] parsing malformed browser message payload, simulationId={}, payload={}",
                    simulationId, malformedMessage);
            objectMapper.readTree(malformedMessage);
        } catch (Exception e) {
            log.error("[FaultSimulation] expected message parse failure captured, simulationId={}, projectId={}, payload={}",
                    simulationId, request.getProjectId(), malformedMessage, e);
            throw new IllegalArgumentException("Malformed browser message payload, simulationId=" + simulationId, e);
        }
    }
}
