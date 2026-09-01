## ADDED Requirements

### Requirement: Execution status sync service

The system SHALL provide a scheduled task `ExecutionStatusSyncService` that polls the execute-service for running execution statuses every 10 seconds.

#### Scenario: Poll running executions periodically
- **WHEN** the scheduled task runs (every 10 seconds)
- **THEN** the system SHALL query all `ExecutionRecord` entries with status `RUNNING`
- **AND** for each running execution, call `GET /execute/:id/status` on execute-service

#### Scenario: Update status to SUCCESS when completed
- **WHEN** the status poll returns `completed`
- **THEN** the system SHALL update the `ExecutionRecord` status to `SUCCESS`
- **AND** update the `TestCase` status to `SUCCESS`
- **AND** create a new `Report` record with the execution details
- **AND** update `TestCase.htmlReportPath` with the report URL from execute-service

#### Scenario: Update status to FAILED when failed
- **WHEN** the status poll returns `failed` or `cancelled`
- **THEN** the system SHALL update the `ExecutionRecord` status to `FAILED`
- **AND** update the `TestCase` status to `FAILED`
- **AND** create a new `Report` record with the failure details
- **AND** update `TestCase.htmlReportPath` if a report URL is available

#### Scenario: Handle status mapping
The system SHALL map execute-service status values to internal status as follows:

| execute-service status | Internal status |
|-----------------------|----------------|
| `pending` / `queued` / `running` | `RUNNING` |
| `completed` | `SUCCESS` |
| `failed` / `cancelled` | `FAILED` |
| Any other value | `UNKNOWN` |

#### Scenario: Handle execute-service errors
- **WHEN** the status poll call to execute-service fails (network error, timeout, etc.)
- **THEN** the system SHALL log the error
- **AND** continue processing other running executions
- **AND** not update the `ExecutionRecord` or `TestCase` status

### Requirement: Execution service integration

The execution services (`ExecutionService`, `CaseExecutionService`) SHALL create an `ExecutionRecord` entry after successfully calling `asyncExecute` on execute-service.

#### Scenario: Create record after successful submission
- **WHEN** an execution service receives a successful response from `asyncExecute` containing an `executionId`
- **THEN** the system SHALL create an `ExecutionRecord` with the returned `executionId`
- **AND** set the initial status to `RUNNING`
