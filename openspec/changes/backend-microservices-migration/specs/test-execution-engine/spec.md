## ADDED Requirements

### Requirement: Engine can accept execution tasks
The Engine Service SHALL accept test execution requests and schedule them for processing.

#### Scenario: Submit execution task
- **WHEN** a POST request is sent to `/api/engine/execute` with body containing `caseId`, `nlp`, `yamlFlow`, `url`, `aiConfig`
- **THEN** the Engine SHALL generate a unique `taskId`
- **AND** return HTTP 202 with body `{"taskId": "<uuid>", "status": "QUEUED"}`
- **AND** start executing the test asynchronously

#### Scenario: Submit execution with missing required fields
- **WHEN** a POST request is sent with missing `caseId`
- **THEN** the Engine SHALL return HTTP 400 with body `{"error": "caseId is required"}`

### Requirement: Client can query execution status
The Engine SHALL provide endpoints to query the status of an execution task.

#### Scenario: Query running task status
- **WHEN** a GET request is sent to `/api/engine/status/{taskId}`
- **THEN** the Engine SHALL return HTTP 200 with current status: `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`
- **AND** include progress percentage if running

#### Scenario: Query non-existent task
- **WHEN** a GET request is sent with a non-existent `taskId`
- **THEN** the Engine SHALL return HTTP 404 with body `{"error": "Task not found"}`

### Requirement: Engine provides real-time execution logs via SSE
The Engine SHALL stream execution logs to connected clients using Server-Sent Events.

#### Scenario: Stream logs via SSE
- **WHEN** a GET request is sent to `/sse/logs/{taskId}`
- **THEN** the Engine SHALL establish an SSE connection
- **AND** send log events as they are generated
- **AND** close the connection when execution completes

#### Scenario: SSE with non-existent task
- **WHEN** a GET request is sent to `/sse/logs/{taskId}` with a non-existent task ID
- **THEN** the Engine SHALL send an SSE event with `{"error": "Task not found"}`
- **AND** close the connection

### Requirement: Client can cancel running tasks
The Engine SHALL allow clients to cancel a running execution task.

#### Scenario: Cancel running task
- **WHEN** a DELETE request is sent to `/api/engine/task/{taskId}`
- **THEN** if task is running, the Engine SHALL terminate the execution process
- **AND** return HTTP 200 with body `{"success": true, "message": "Task cancelled"}`

#### Scenario: Cancel completed task
- **WHEN** a DELETE request is sent to `/api/engine/task/{taskId}` for a completed task
- **THEN** the Engine SHALL return HTTP 400 with body `{"error": "Cannot cancel completed task"}`

### Requirement: Engine provides health check endpoint
The Engine SHALL expose a health check endpoint for monitoring.

#### Scenario: Health check
- **WHEN** a GET request is sent to `/api/engine/health`
- **THEN** the Engine SHALL return HTTP 200 with body `{"status": "UP", "timestamp": "<ISO8601>"}`
