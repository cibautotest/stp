## ADDED Requirements

### Requirement: Report list data source

The system SHALL fetch report list data from the backend API `GET /api/platform/reports` instead of filtering from the test case list.

#### Scenario: Fetch reports from backend API
- **WHEN** the report list page is loaded
- **THEN** the frontend SHALL call `GET /api/platform/reports` with `page` and `size` parameters
- **AND** the table SHALL display data returned by the backend API

#### Scenario: Backend returns report list with joined project info
- **WHEN** the backend receives a paginated report list request
- **THEN** the response SHALL include `projectName` field by JOINing `projects` table
- **AND** the report `name` field SHALL be used as the report's display name (not caseName)

### Requirement: Report list table columns

The report list table SHALL display the following columns: report ID, report name, project name, execution status, duration, and creation time.

#### Scenario: Display report list columns
- **WHEN** report list data is loaded
- **THEN** the table SHALL display columns: 报告ID, 报告名称, 所属项目, 执行状态, 执行耗时, 报告时间

### Requirement: Filter reports by project

The report list page SHALL support filtering reports by project.

#### Scenario: Filter by project
- **WHEN** user selects a project from the project filter dropdown
- **THEN** the system SHALL send `projectId` parameter to the backend API
- **AND** only reports belonging to the selected project SHALL be displayed

#### Scenario: Clear project filter
- **WHEN** user clears the project filter
- **THEN** the system SHALL reload all reports without project filtering

### Requirement: Server-side pagination

The report list SHALL use server-side pagination instead of client-side pagination.

#### Scenario: Paginated report list
- **WHEN** user navigates to a different page or changes page size
- **THEN** the frontend SHALL send `page` and `size` parameters to the backend API
- **AND** the pagination component SHALL display the `total` count from the backend response

### Requirement: Delete report

The report list SHALL support deleting individual reports.

#### Scenario: Delete a report
- **WHEN** user clicks the delete button on a report row and confirms the deletion dialog
- **THEN** the frontend SHALL call `DELETE /api/platform/reports/{id}`
- **AND** the report SHALL be removed from the database
- **AND** the list SHALL refresh automatically
