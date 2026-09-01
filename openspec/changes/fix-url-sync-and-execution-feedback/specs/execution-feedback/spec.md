## ADDED Requirements

### Requirement: Execution log shows queue position
The system SHALL display the current queue position in execution logs when a task is in `queued` state.

#### Scenario: Task queued with position
- **WHEN** the frontend polls execution status and receives `status: "queued"` with `queuePosition: 2`
- **THEN** the execution log SHALL display "排队中（第 2 位），等待执行..."

#### Scenario: Task queued with unknown position
- **WHEN** the frontend polls execution status and receives `status: "queued"` with `queuePosition: -1`
- **THEN** the execution log SHALL display "任务已入队，等待执行..."

### Requirement: Execution log shows specific failure reasons
The system SHALL display precise failure information instead of generic error messages when execution fails.

#### Scenario: Execution submission failure
- **WHEN** the create-and-execute API returns `executionId: null`
- **THEN** the execution log SHALL display "用例已保存，但执行提交失败（检查 YAML 是否包含 web.url 和 tasks）"

#### Scenario: Polling timeout
- **WHEN** the frontend polling loop reaches maxPolls (100) without terminal status
- **THEN** the execution log SHALL display "执行超时：已等待 300 秒（100 次轮询），任务未在预期时间内完成"

#### Scenario: Worker execution failure with error detail
- **WHEN** the frontend polls execution status and receives `status: "failed"` with `error: "Executable doesn't exist at ..."`
- **THEN** the execution log SHALL display the specific error message: "测试执行失败：Executable doesn't exist at ..."

#### Scenario: Network error during polling
- **WHEN** the frontend encounters a network error during polling (e.g., execute-service unreachable)
- **THEN** the execution log SHALL display "执行状态查询失败：无法连接到执行服务，请检查服务是否运行"

### Requirement: Execute-service status API returns error details
The execute-service SHALL include the `error` field in status query responses when execution has failed.

#### Scenario: Failed execution with error
- **WHEN** GET `/execute/{executionId}/status` is called after a Worker execution failure
- **THEN** the response SHALL include `"error": "<specific error message>"` with the actual Worker error
- **AND** `"status": "failed"`

#### Scenario: Running execution without error
- **WHEN** GET `/execute/{executionId}/status` is called while the task is still running
- **THEN** the response SHALL NOT include a non-null `error` field, or `error` SHALL be `null`
