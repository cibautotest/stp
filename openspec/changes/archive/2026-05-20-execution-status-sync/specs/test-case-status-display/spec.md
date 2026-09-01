## ADDED Requirements

### Requirement: Test case status field

The system SHALL provide a `status` field for test cases that reflects the current execution state.

#### Scenario: Test case status values
The `TestCase` entity SHALL support the following status values:

| Status | Description |
|--------|-------------|
| `PENDING` | Test case has not been executed |
| `RUNNING` | Test case execution is in progress |
| `SUCCESS` | Test case executed successfully |
| `FAILED` | Test case execution failed |
| `UNKNOWN` | Execution status could not be determined |

### Requirement: Test case list display

The frontend test case list SHALL display the current status of each test case.

#### Scenario: Display status badge in case list
- **WHEN** the user views the test case list page
- **THEN** the system SHALL display a status badge for each test case
- **AND** the badge SHALL use color coding: PENDING (gray), RUNNING (blue), SUCCESS (green), FAILED (red), UNKNOWN (yellow)

### Requirement: Latest report link

The frontend test case list SHALL provide a way to access the latest execution report.

#### Scenario: Display latest report button
- **WHEN** the user views the test case list page
- **THEN** the system SHALL display a "Latest Report" button for test cases that have an `htmlReportPath`
- **AND** clicking the button SHALL open the report URL in a new browser tab

#### Scenario: Report button hidden for pending cases
- **WHEN** a test case has no execution history (status is `PENDING`)
- **THEN** the system SHALL hide the "Latest Report" button for that case
