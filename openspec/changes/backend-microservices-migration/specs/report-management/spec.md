## ADDED Requirements

### Requirement: System generates execution report
The system SHALL generate a detailed report after test execution completes.

#### Scenario: Generate report on successful execution
- **WHEN** a test case execution completes successfully
- **THEN** the system SHALL create a report with `caseId`, `status`, `duration`, `timestamp`, `logs`, `result`
- **AND** save the report to the reports database table

#### Scenario: Generate report on failed execution
- **WHEN** a test case execution fails
- **THEN** the system SHALL create a report with `caseId`, `status: "FAILED"`, `error`, `duration`, `timestamp`, `logs`

### Requirement: User can retrieve execution report
The system SHALL allow users to retrieve test execution reports.

#### Scenario: Get report by case ID
- **WHEN** a GET request is sent to `/api/platform/reports/{caseId}`
- **THEN** the system SHALL return HTTP 200 with the report object
- **AND** include an HTML-formatted report view

#### Scenario: Get report for non-existent case
- **WHEN** a GET request is sent with a non-existent case ID
- **THEN** the system SHALL return HTTP 404 with body `{"error": "Report not found"}`

### Requirement: User can list execution reports
The system SHALL provide an endpoint to list reports with pagination.

#### Scenario: List reports with pagination
- **WHEN** a GET request is sent to `/api/platform/reports?page=1&size=10`
- **THEN** the system SHALL return HTTP 200 with paginated report list
- **AND** include `total`, `page`, `size`, `items` fields

#### Scenario: List reports filtered by project
- **WHEN** a GET request is sent to `/api/platform/reports?projectId={projectId}`
- **THEN** the system SHALL return only reports for cases in the specified project

### Requirement: Report includes execution logs
The report SHALL contain the complete execution log for debugging purposes.

#### Scenario: Report contains logs
- **WHEN** a report is retrieved
- **THEN** the report SHALL include a `logs` array with all execution log entries
- **AND** each log entry SHALL have `timestamp` and `message`
