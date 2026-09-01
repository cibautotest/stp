## ADDED Requirements

### Requirement: Execute entire test plan
The system SHALL provide an API endpoint to trigger execution of all test cases in a test plan, in ascending `sort_order` sequence.

#### Scenario: Trigger plan execution successfully
- **WHEN** a user POSTs to `/api/platform/plans/{id}/execute` with a valid plan ID that has at least one associated test case
- **THEN** the system SHALL generate a unique batchId, return `{ batchId, totalCases }` with HTTP 202, and begin executing cases sequentially in sort_order in a background thread

#### Scenario: Plan has no cases
- **WHEN** a user POSTs to `/api/platform/plans/{id}/execute` with a plan that has zero associated test cases
- **THEN** the system SHALL return HTTP 400 with error message "计划中没有用例，无法执行"

#### Scenario: Plan not found
- **WHEN** a user POSTs to `/api/platform/plans/{id}/execute` with a non-existent plan ID
- **THEN** the system SHALL return HTTP 404 with error message "计划不存在"

#### Scenario: Plan is already executing
- **WHEN** a user POSTs to `/api/platform/plans/{id}/execute` for a plan whose `last_batch_id` still has RUNNING execution records
- **THEN** the system SHALL return HTTP 409 with error message "该计划正在执行中"

### Requirement: Serial execution by sort_order
The system SHALL execute test cases within a plan one at a time, in ascending order of `test_plan_cases.sort_order`, waiting for each case to complete before submitting the next.

#### Scenario: Cases execute in correct order
- **WHEN** a plan has 3 cases with sort_order 0, 1, 2
- **THEN** case sort_order=0 SHALL be submitted first, and case sort_order=1 SHALL NOT be submitted until sort_order=0 completes

#### Scenario: Failed case does not block subsequent cases
- **WHEN** case sort_order=0 fails during execution
- **THEN** the system SHALL continue to submit and execute case sort_order=1

#### Scenario: Case with no script is skipped
- **WHEN** a case in the plan has no `yaml_flow` or `script`
- **THEN** the system SHALL mark it as FAILED with reason "用例无执行脚本" and proceed to the next case

### Requirement: Plan execution history recording
The system SHALL record execution history on the `test_plans` table after all cases in a plan execution complete.

#### Scenario: All cases pass
- **WHEN** all cases in a plan execution complete with status SUCCESS
- **THEN** the system SHALL update `test_plans` with `last_executed_at` = now, `last_execution_result` = "PASSED", `last_batch_id` = batchId

#### Scenario: Some cases fail
- **WHEN** a plan execution completes with 2 failed cases out of 5 total
- **THEN** the system SHALL update `test_plans` with `last_execution_result` = "2_FAILED" and `last_batch_id` = batchId

#### Scenario: All cases fail
- **WHEN** all cases in a plan execution complete with status FAILED
- **THEN** the system SHALL update `test_plans` with `last_execution_result` = "FAILED" and `last_batch_id` = batchId

### Requirement: Frontend plan execution entry
The frontend SHALL provide an "Execute" button on each test plan card in the plan list page.

#### Scenario: User clicks execute on a plan with cases
- **WHEN** a user clicks the "执行" button on a plan card that has at least one case
- **THEN** the frontend SHALL call `POST /api/platform/plans/{id}/execute`, open the BatchProgressDialog with the returned batchId, and show live progress

#### Scenario: Execute button disabled during execution
- **WHEN** a plan's `last_batch_id` corresponds to an execution that is still RUNNING
- **THEN** the "执行" button SHALL be disabled and show "执行中"

#### Scenario: Execution history displayed on plan card
- **WHEN** a plan has `last_execution_result` set to "PASSED"
- **THEN** the plan card SHALL display a green tag indicating "上次执行: 全部通过" with the execution time

#### Scenario: Partial failure displayed
- **WHEN** a plan has `last_execution_result` set to "2_FAILED"
- **THEN** the plan card SHALL display an orange tag indicating "上次执行: 2 个失败" with the execution time

### Requirement: Batch report generation after plan execution
After all cases in a plan execution complete, the system SHALL trigger a batch merge report via the existing `checkAndMergeBatch` mechanism.

#### Scenario: Batch report generated after plan execution
- **WHEN** all cases in a plan's batchId have completed execution
- **THEN** the system SHALL call `checkAndMergeBatch(batchId)` to generate a merged BATCH report, and the BatchProgressDialog SHALL show a "查看合并报告" button
