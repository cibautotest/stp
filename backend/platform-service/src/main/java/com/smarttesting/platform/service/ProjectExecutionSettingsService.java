package com.smarttesting.platform.service;

import com.smarttesting.platform.entity.Project;
import com.smarttesting.platform.model.ExecuteRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;

/** Applies project-level execution behavior settings before dispatching to execute-service. */
@Service
public class ProjectExecutionSettingsService {
    private static final Logger log = LoggerFactory.getLogger(ProjectExecutionSettingsService.class);

    @Resource
    private ProjectService projectService;

    @Value("${spring.kafka.bootstrap-servers:}")
    private String kafkaBrokers;
    @Value("${observability.kafka.topic:ui-test-api-exchange.v1}")
    private String kafkaTopic;
    @Value("${observability.kafka.client-id:smart-testing-execute}")
    private String kafkaClientId;
    @Value("${observability.kafka.username:}")
    private String kafkaUsername;
    @Value("${observability.kafka.password:}")
    private String kafkaPassword;

    public void apply(String projectId, ExecuteRequest request) {
        Project project = projectId == null || projectId.isBlank() ? null : projectService.getById(projectId);
        boolean trafficTaggingEnabled = project != null && Boolean.TRUE.equals(project.getTrafficTaggingEnabled());
        boolean kafkaEnabled = project != null && Boolean.TRUE.equals(project.getApiExchangeKafkaEnabled());

        request.setTrafficTaggingEnabled(trafficTaggingEnabled);
        request.setKafkaConfig(new ExecuteRequest.KafkaConfig(
                kafkaEnabled, kafkaBrokers, kafkaTopic, kafkaClientId, kafkaUsername, kafkaPassword));

        log.info("Apply project execution settings: projectId={}, trafficTaggingEnabled={}, apiExchangeKafkaEnabled={}, kafkaBrokersConfigured={}, kafkaTopic={}, kafkaClientId={}",
                projectId, trafficTaggingEnabled, kafkaEnabled, kafkaBrokers != null && !kafkaBrokers.isBlank(), kafkaTopic, kafkaClientId);
    }
}
