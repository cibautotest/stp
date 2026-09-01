## ADDED Requirements

### Requirement: Execution record entity

The system SHALL provide an `ExecutionRecord` entity that stores the mapping between a `caseId` and its corresponding `executionId` from the execute-service.

#### Scenario: Create execution record when test case is submitted
- **WHEN** a test case execution is submitted to execute-service via `asyncExecute`
- **THEN** the system SHALL create an `ExecutionRecord` with `caseId`, `executionId`, `createdAt`, and initial status `RUNNING`

#### Scenario: Query caseId by executionId
- **WHEN** a system component has an `executionId` and needs to find the corresponding `caseId`
- **THEN** the system SHALL provide a method to query `ExecutionRecord` by `executionId` and return the associated `caseId`

#### Scenario: Query running executions
- **WHEN** the status sync service needs to poll running executions
- **THEN** the system SHALL provide a method to query all `ExecutionRecord` entries with status `RUNNING`
